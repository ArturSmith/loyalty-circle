package com.clubcarder.app.auth

import androidx.annotation.StringRes
import androidx.compose.runtime.Immutable
import com.clubcarder.app.R
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Which set of fields the screen is asking for.
 *
 * The XML version drove this with `renderMode()`, a 30-line method calling
 * setVisibility on seventeen views. Every new field meant remembering to hide
 * it in three other branches, and forgetting was silent. Here the mode simply
 * decides what is emitted.
 */
enum class AuthMode { PHONE, EMAIL, SIGN_UP, RESET }

@Immutable
data class CountryOption(
    val region: String,
    val callingCode: Int,
    val name: String,
) {
    /** Flag emoji derived from the ISO region, so no flag assets are shipped. */
    val flag: String
        get() {
            if (region.length != 2) return ""
            val upper = region.uppercase(Locale.ROOT)
            val first = Character.codePointAt(upper, 0) - 'A'.code + 0x1F1E6
            val second = Character.codePointAt(upper, 1) - 'A'.code + 0x1F1E6
            return String(Character.toChars(first)) + String(Character.toChars(second))
        }

    val dialLabel: String get() = "$flag  +$callingCode"

    override fun toString(): String = "$flag  +$callingCode  $name"
}

/**
 * Everything the sign-in screen renders from.
 *
 * Held as one immutable value rather than a dozen `mutableStateOf` fields so
 * an invalid combination — say, `otpSent` true while the phone is null — is
 * visible in one place instead of spread across setters.
 */
@Immutable
data class LoginUiState(
    val mode: AuthMode = AuthMode.PHONE,
    val loading: Boolean = false,
    val otpSent: Boolean = false,
    val error: String? = null,

    val countries: List<CountryOption> = emptyList(),
    val country: CountryOption? = null,
    val countryQuery: String = "",
    val countryPickerOpen: Boolean = false,

    val phone: String = "",
    val otp: String = "",
    val fullName: String = "",
    /** ISO yyyy-MM-dd; empty when unset. Kept ISO so it never needs re-parsing. */
    val dateOfBirth: String = "",
    val email: String = "",
    val password: String = "",
    val confirmPassword: String = "",
) {
    val showPhoneFields: Boolean get() = mode == AuthMode.PHONE
    val showOtpField: Boolean get() = mode == AuthMode.PHONE && otpSent
    val showNameFields: Boolean get() = mode == AuthMode.SIGN_UP
    val showEmailField: Boolean
        get() = mode == AuthMode.EMAIL || mode == AuthMode.SIGN_UP || mode == AuthMode.RESET
    val showPasswordField: Boolean get() = mode == AuthMode.EMAIL || mode == AuthMode.SIGN_UP
    val showConfirmPassword: Boolean get() = mode == AuthMode.SIGN_UP
    val showSocialButtons: Boolean get() = mode == AuthMode.PHONE || mode == AuthMode.EMAIL
    val showForgotPassword: Boolean get() = mode == AuthMode.EMAIL
    val showBottomLinks: Boolean get() = mode != AuthMode.RESET

    /** Country and phone are locked once the code is on its way. */
    val phoneEditable: Boolean get() = !otpSent && !loading

    val filteredCountries: List<CountryOption>
        get() {
            val query = countryQuery.trim()
            if (query.isEmpty()) return countries
            return countries.filter {
                it.name.contains(query, ignoreCase = true) ||
                    it.callingCode.toString().contains(query) ||
                    it.region.equals(query, ignoreCase = true)
            }
        }

    @get:StringRes
    val titleRes: Int
        get() = when (mode) {
            AuthMode.SIGN_UP -> R.string.auth_signup_title
            AuthMode.RESET -> R.string.auth_reset_title
            else -> R.string.auth_welcome_title
        }

    @get:StringRes
    val subtitleRes: Int
        get() = when (mode) {
            AuthMode.SIGN_UP -> R.string.auth_signup_subtitle
            AuthMode.RESET -> R.string.auth_reset_subtitle
            else -> R.string.auth_welcome_subtitle
        }

    /**
     * The label on the main action.
     *
     * The XML version set this in `renderMode()` and then again in
     * `setLoading()`, so the two could disagree — clearing an error reset the
     * button back to "Continue" while a request was still in flight. Deriving
     * it from a single state removes that possibility.
     */
    @get:StringRes
    val primaryButtonRes: Int
        get() = when {
            loading && mode == AuthMode.EMAIL -> R.string.auth_signing_in
            loading && mode == AuthMode.SIGN_UP -> R.string.auth_creating_account
            loading && mode == AuthMode.RESET -> R.string.auth_sending_reset
            loading -> R.string.auth_please_wait
            mode == AuthMode.PHONE && otpSent -> R.string.auth_verify_code
            mode == AuthMode.PHONE -> R.string.auth_continue
            mode == AuthMode.EMAIL -> R.string.auth_sign_in
            mode == AuthMode.SIGN_UP -> R.string.auth_create_account
            else -> R.string.auth_send_reset
        }

    /**
     * The stored ISO date rendered in the user's locale, or empty when unset.
     *
     * java.time would read better, but minSdk is 24 and java.time only arrived
     * in API 26 — using it would mean turning on core library desugaring for
     * one label.
     */
    val dateOfBirthLabel: String
        get() {
            if (dateOfBirth.isEmpty()) return ""
            return runCatching {
                val iso = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT)
                val parsed = iso.parse(dateOfBirth) ?: return dateOfBirth
                DateFormat.getDateInstance(DateFormat.MEDIUM, Locale.getDefault()).format(parsed)
            }.getOrDefault(dateOfBirth)
        }
}
