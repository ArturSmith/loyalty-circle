package com.clubcarder.app

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Patterns
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.view.WindowCompat
import com.clubcarder.app.auth.AuthMode
import com.clubcarder.app.auth.AuthTheme
import com.clubcarder.app.auth.BirthDatePickerDialog
import com.clubcarder.app.auth.CountryOption
import com.clubcarder.app.auth.LoginActions
import com.clubcarder.app.auth.LoginScreen
import com.clubcarder.app.auth.LoginViewModel
import com.google.i18n.phonenumbers.PhoneNumberUtil
import org.json.JSONException
import org.json.JSONObject
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

/**
 * Native sign-in, replacing the web form on Android.
 *
 * The UI is Compose; everything below it — Supabase calls, the OAuth handshake
 * and the handover to the Capacitor WebView — is unchanged from the XML
 * version, and the session is still written to the same SharedPreferences key
 * the WebView reads on start.
 */
class LoginActivity : AppCompatActivity() {

    companion object {
        // `const` so MainActivity, which is still Java, keeps compiling
        // against LoginActivity.EXTRA_REDIRECT unchanged.
        const val EXTRA_REDIRECT = "native_auth_redirect"

        private const val NATIVE_AUTH_PREFS = "ClubCarderNativeAuth"
        private const val PENDING_STATE = "pending_oauth_state"
        private const val PENDING_REDIRECT = "pending_redirect"
        // Lovable's broker explicitly allow-lists this mobile callback. It
        // returns the OAuth tokens here after the system-browser flow.
        private const val OAUTH_CALLBACK = "lovable://oauth-callback"

        private const val MIN_AGE = 13
        private const val MAX_AGE = 120
    }

    private val phoneUtil: PhoneNumberUtil by lazy { PhoneNumberUtil.getInstance() }
    private val secureRandom = SecureRandom()

    private lateinit var authClient: SupabaseAuthClient
    private var redirectPath: String? = null

    /** Held outside the ViewModel: it is a transient dialog, not form data. */
    private var showBirthDatePicker by mutableStateOf(false)

    // Resolved here rather than inside the composition so onNewIntent, which
    // can arrive before or after composition, always has it.
    private val model: LoginViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // targetSdk 36 draws edge to edge regardless; opting in explicitly is
        // what makes the statusBarsPadding/imePadding modifiers meaningful.
        WindowCompat.setDecorFitsSystemWindows(window, false)

        redirectPath = safeRedirect(intent.getStringExtra(EXTRA_REDIRECT))
        redirectPath?.let {
            getSharedPreferences(NATIVE_AUTH_PREFS, MODE_PRIVATE).edit()
                .putString(PENDING_REDIRECT, it).apply()
        }

        authClient = SupabaseAuthClient(
            BuildConfig.SUPABASE_URL,
            BuildConfig.SUPABASE_PUBLISHABLE_KEY,
        )

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // The native activity replaces the Android web login rather
                // than acting like a dialog over it.
                finishAffinity()
            }
        })

        setContent {
            LaunchedEffect(Unit) {
                if (model.state.countries.isEmpty()) {
                    // ClubCarder launches in Norway, matching the web sign-in
                    // default. Every supported country stays available.
                    model.setCountries(loadCountries(), defaultRegion = "NO")
                }
            }

            AuthTheme {
                LoginScreen(state = model.state, actions = actionsFor(model))

                if (showBirthDatePicker) {
                    BirthDatePickerDialog(
                        initialIsoDate = model.state.dateOfBirth,
                        onDismiss = { showBirthDatePicker = false },
                        onSelect = { iso ->
                            showBirthDatePicker = false
                            model.setDateOfBirth(iso)
                        },
                    )
                }
            }
        }

        handleOAuthCallback(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleOAuthCallback(intent)
    }

    /* ------------------------------------------------------------ wiring */

    private fun actionsFor(viewModel: LoginViewModel) = LoginActions(
        onPhoneChange = viewModel::setPhone,
        onOtpChange = viewModel::setOtp,
        onFullNameChange = viewModel::setFullName,
        onEmailChange = viewModel::setEmail,
        onPasswordChange = viewModel::setPassword,
        onConfirmPasswordChange = viewModel::setConfirmPassword,
        onCountryPickerOpen = viewModel::openCountryPicker,
        onCountryPickerDismiss = viewModel::dismissCountryPicker,
        onCountryQueryChange = viewModel::setCountryQuery,
        onCountrySelect = viewModel::selectCountry,
        onBirthDateClick = { showBirthDatePicker = true },
        onSubmit = { submit(viewModel) },
        onChangeNumber = viewModel::changeNumber,
        onForgotPassword = { viewModel.setMode(AuthMode.RESET) },
        onToggleMethod = {
            viewModel.setMode(
                if (viewModel.state.mode == AuthMode.PHONE) AuthMode.EMAIL else AuthMode.PHONE,
            )
        },
        onBackToSignIn = { viewModel.setMode(AuthMode.EMAIL) },
        onGoogle = { startOAuth("google") },
        onApple = { startOAuth("apple") },
        onHelp = { openExternal("https://clubcarder.com/help") },
        onCreateAccount = {
            viewModel.setMode(
                if (viewModel.state.mode == AuthMode.SIGN_UP) AuthMode.PHONE else AuthMode.SIGN_UP,
            )
        },
    )

    /* -------------------------------------------------------- submission */

    private fun submit(viewModel: LoginViewModel) {
        viewModel.clearError()
        if (!NativeConnectivity.isOnline(this)) {
            viewModel.showError(getString(R.string.auth_network_error))
            return
        }
        if (!authClient.isConfigured) {
            viewModel.showError(getString(R.string.auth_configuration_error))
            return
        }
        when (viewModel.state.mode) {
            AuthMode.PHONE -> submitPhone(viewModel)
            AuthMode.EMAIL -> submitEmail(viewModel)
            AuthMode.SIGN_UP -> submitSignUp(viewModel)
            AuthMode.RESET -> submitReset(viewModel)
        }
    }

    private fun submitPhone(viewModel: LoginViewModel) {
        val state = viewModel.state
        if (!state.otpSent) {
            val normalized = normalizePhone(state.phone, state.country)
            if (normalized == null) {
                viewModel.showError(getString(R.string.auth_invalid_phone))
                return
            }
            viewModel.setLoading(true)
            authClient.sendPhoneOtp(normalized) { _, error ->
                runOnUiThread {
                    if (error != null) {
                        viewModel.showError(friendlyError(error))
                        return@runOnUiThread
                    }
                    viewModel.onOtpSent()
                    Toast.makeText(this, R.string.auth_sms_sent, Toast.LENGTH_LONG).show()
                }
            }
            return
        }

        val code = state.otp.replace("\\s".toRegex(), "")
        val normalized = normalizePhone(state.phone, state.country)
        if (code.length < 4 || normalized == null) {
            viewModel.showError(getString(R.string.auth_invalid_code))
            return
        }
        viewModel.setLoading(true)
        authClient.verifyPhoneOtp(normalized, code, sessionCallback(viewModel))
    }

    private fun submitEmail(viewModel: LoginViewModel) {
        val email = viewModel.state.email.trim().lowercase(Locale.ROOT)
        val password = viewModel.state.password
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            viewModel.showError(getString(R.string.auth_invalid_email))
            return
        }
        if (password.isEmpty()) {
            viewModel.showError(getString(R.string.auth_missing_password))
            return
        }
        viewModel.setLoading(true)
        authClient.signInWithPassword(email, password, sessionCallback(viewModel))
    }

    private fun submitSignUp(viewModel: LoginViewModel) {
        val state = viewModel.state
        val name = state.fullName.trim()
        val email = state.email.trim().lowercase(Locale.ROOT)
        val password = state.password

        if (name.length < 2 || name.length > 80) {
            viewModel.showError(getString(R.string.auth_invalid_name))
            return
        }
        when (ageProblem(state.dateOfBirth)) {
            AgeProblem.MISSING_OR_INVALID -> {
                viewModel.showError(getString(R.string.auth_invalid_dob)); return
            }
            AgeProblem.TOO_YOUNG -> {
                viewModel.showError(getString(R.string.auth_too_young)); return
            }
            AgeProblem.NONE -> Unit
        }
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            viewModel.showError(getString(R.string.auth_invalid_email))
            return
        }
        if (password.length < 6) {
            viewModel.showError(getString(R.string.auth_password_short))
            return
        }
        if (password != state.confirmPassword) {
            viewModel.showError(getString(R.string.auth_password_mismatch))
            return
        }

        viewModel.setLoading(true)
        authClient.signUp(name, state.dateOfBirth, email, password) { response, error ->
            runOnUiThread {
                if (error != null) {
                    viewModel.showError(friendlyError(error))
                    return@runOnUiThread
                }
                if (hasSession(response)) {
                    completeLogin(viewModel, response)
                    return@runOnUiThread
                }
                Toast.makeText(this, R.string.auth_confirmation_sent, Toast.LENGTH_LONG).show()
                viewModel.setLoading(false)
                viewModel.setMode(AuthMode.EMAIL)
                viewModel.setEmail(email)
            }
        }
    }

    private fun submitReset(viewModel: LoginViewModel) {
        val email = viewModel.state.email.trim().lowercase(Locale.ROOT)
        if (!Patterns.EMAIL_ADDRESS.matcher(email).matches()) {
            viewModel.showError(getString(R.string.auth_invalid_email))
            return
        }
        viewModel.setLoading(true)
        authClient.sendPasswordReset(email) { _, error ->
            runOnUiThread {
                if (error != null) {
                    viewModel.showError(friendlyError(error))
                    return@runOnUiThread
                }
                Toast.makeText(this, R.string.auth_reset_sent, Toast.LENGTH_LONG).show()
                viewModel.setLoading(false)
                viewModel.setMode(AuthMode.EMAIL)
                viewModel.setEmail(email)
            }
        }
    }

    private fun sessionCallback(viewModel: LoginViewModel) =
        SupabaseAuthClient.Callback { response, error ->
            runOnUiThread {
                if (error != null) {
                    viewModel.showError(friendlyError(error))
                    return@runOnUiThread
                }
                completeLogin(viewModel, response)
            }
        }

    /* ------------------------------------------------------------ session */

    private fun completeLogin(viewModel: LoginViewModel, response: JSONObject?) {
        try {
            val session = response?.optJSONObject("session") ?: response
            if (session == null ||
                !session.has("access_token") ||
                !session.has("refresh_token")
            ) {
                viewModel.showError(getString(R.string.auth_network_error))
                return
            }
            if (!session.has("expires_at")) {
                val expiresIn = session.optLong("expires_in", 3600L)
                session.put("expires_at", System.currentTimeMillis() / 1000L + expiresIn)
            }

            getSharedPreferences(NativeSessionStore.PREFERENCES, MODE_PRIVATE).edit()
                .putString(NativeSessionStore.storageKey(BuildConfig.SUPABASE_URL), session.toString())
                .apply()

            val pending = getSharedPreferences(NATIVE_AUTH_PREFS, MODE_PRIVATE)
            val savedRedirect = safeRedirect(pending.getString(PENDING_REDIRECT, null))
            pending.edit().remove(PENDING_STATE).remove(PENDING_REDIRECT).apply()
            restartApp(savedRedirect ?: redirectPath)
        } catch (error: JSONException) {
            viewModel.showError(getString(R.string.auth_network_error))
        }
    }

    private fun restartApp(redirect: String?) {
        val intent = Intent(this, MainActivity::class.java)
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        if (redirect != null) intent.putExtra(EXTRA_REDIRECT, redirect)
        startActivity(intent)
        finish()
    }

    /* -------------------------------------------------------------- oauth */

    private fun startOAuth(provider: String) {
        if (model.state.loading) return
        if (!NativeConnectivity.isOnline(this)) {
            model.showError(getString(R.string.auth_network_error))
            return
        }

        val stateBytes = ByteArray(24)
        secureRandom.nextBytes(stateBytes)
        val state = stateBytes.joinToString("") {
            String.format(Locale.ROOT, "%02x", it.toInt() and 0xff)
        }

        getSharedPreferences(NATIVE_AUTH_PREFS, MODE_PRIVATE).edit()
            .putString(PENDING_STATE, state)
            .putString(PENDING_REDIRECT, redirectPath ?: "")
            .apply()

        // Use the same Lovable broker as the web client, but launch it in the
        // system browser and request the broker's supported mobile callback.
        // This keeps Google/Apple out of the WebView and returns straight to
        // this native activity instead of rendering the web login page.
        val target = Uri.parse("https://clubcarder.com/~oauth/initiate").buildUpon()
            .appendQueryParameter("provider", provider)
            .appendQueryParameter("redirect_uri", OAUTH_CALLBACK)
            .appendQueryParameter("state", state)
        if (provider == "google") target.appendQueryParameter("prompt", "select_account")
        openExternal(target.build().toString())
    }

    private fun handleOAuthCallback(intent: Intent) {
        val uri = intent.data ?: return
        if (uri.scheme != "lovable" || uri.host != "oauth-callback") return

        // Depending on the broker/provider, values can arrive in either the
        // query or fragment. Preserve both; state and tokens are equally
        // important and may be split between them.
        val values = mutableMapOf<String, String>()
        for (name in uri.queryParameterNames.orEmpty()) {
            uri.getQueryParameter(name)?.let { values[name] = it }
        }
        uri.fragment?.takeIf { it.isNotEmpty() }?.let { fragment ->
            val parsed = Uri.parse("$OAUTH_CALLBACK?$fragment")
            for (name in parsed.queryParameterNames.orEmpty()) {
                parsed.getQueryParameter(name)?.let { values[name] = it }
            }
        }

        val pending = getSharedPreferences(NATIVE_AUTH_PREFS, MODE_PRIVATE)
        val expectedState = pending.getString(PENDING_STATE, null)
        val returnedState = values["state"]
        val error = values["error_description"] ?: values["error"]
        if (error != null) {
            pending.edit().remove(PENDING_STATE).apply()
            model.showError(error)
            return
        }
        if (expectedState == null || expectedState != returnedState) {
            model.showError(getString(R.string.auth_oauth_cancelled))
            return
        }

        var refreshToken = values["refresh_token"]
        if (refreshToken.isNullOrEmpty()) {
            values["response"]?.let { encoded ->
                refreshToken = runCatching {
                    JSONObject(encoded).optString("refresh_token")
                }.getOrNull()?.takeIf { it.isNotEmpty() }
            }
        }
        val token = refreshToken
        if (token.isNullOrEmpty()) {
            model.showError(getString(R.string.auth_oauth_cancelled))
            return
        }

        model.setLoading(true)
        authClient.exchangeRefreshToken(token, sessionCallback(model))
    }

    private fun openExternal(url: String) {
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
            .onFailure { model.showError(getString(R.string.auth_open_link_failed)) }
    }

    /* ------------------------------------------------------------ helpers */

    private fun loadCountries(): List<CountryOption> {
        val displayLocale = resources.configuration.locales[0]
        return phoneUtil.supportedRegions
            .mapNotNull { region ->
                val callingCode = phoneUtil.getCountryCodeForRegion(region)
                if (callingCode <= 0) return@mapNotNull null
                val name = Locale.Builder().setRegion(region).build()
                    .getDisplayCountry(displayLocale)
                CountryOption(region, callingCode, name)
            }
            .sortedWith(compareBy(String.CASE_INSENSITIVE_ORDER) { it.name })
    }

    private fun normalizePhone(raw: String, country: CountryOption?): String? {
        if (country == null) return null
        return runCatching {
            val parsed = phoneUtil.parse(raw.trim(), country.region)
            if (!phoneUtil.isValidNumber(parsed)) return null
            phoneUtil.format(parsed, PhoneNumberUtil.PhoneNumberFormat.E164)
        }.getOrNull()
    }

    private enum class AgeProblem { NONE, MISSING_OR_INVALID, TOO_YOUNG }

    private fun ageProblem(isoDate: String): AgeProblem {
        if (isoDate.isEmpty()) return AgeProblem.MISSING_OR_INVALID
        val parsed = runCatching {
            SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).parse(isoDate)
        }.getOrNull() ?: return AgeProblem.MISSING_OR_INVALID

        val birth = Calendar.getInstance().apply { time = parsed }
        val today = Calendar.getInstance()
        var age = today.get(Calendar.YEAR) - birth.get(Calendar.YEAR)
        if (today.get(Calendar.DAY_OF_YEAR) < birth.get(Calendar.DAY_OF_YEAR)) age--

        return when {
            age < MIN_AGE -> AgeProblem.TOO_YOUNG
            age > MAX_AGE -> AgeProblem.MISSING_OR_INVALID
            else -> AgeProblem.NONE
        }
    }

    private fun friendlyError(error: String?): String =
        if (error.isNullOrBlank()) getString(R.string.auth_network_error) else error

    private fun hasSession(response: JSONObject?): Boolean {
        if (response == null) return false
        if (response.has("access_token") && response.has("refresh_token")) return true
        val session = response.optJSONObject("session")
        return session != null &&
            session.has("access_token") &&
            session.has("refresh_token")
    }

    private fun safeRedirect(redirect: String?): String? =
        if (redirect != null && redirect.startsWith("/") && !redirect.startsWith("//")) {
            redirect
        } else {
            null
        }
}
