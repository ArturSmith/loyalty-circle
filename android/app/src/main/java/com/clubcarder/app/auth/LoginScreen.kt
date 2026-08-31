package com.clubcarder.app.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.clubcarder.app.R

/**
 * Callbacks the screen raises. Grouped into one object so adding an action
 * does not mean threading another parameter through every preview and caller.
 */
data class LoginActions(
    val onLanguageChange: (norwegian: Boolean) -> Unit = {},
    val onPhoneChange: (String) -> Unit = {},
    val onOtpChange: (String) -> Unit = {},
    val onFullNameChange: (String) -> Unit = {},
    val onEmailChange: (String) -> Unit = {},
    val onPasswordChange: (String) -> Unit = {},
    val onConfirmPasswordChange: (String) -> Unit = {},
    val onCountryPickerOpen: () -> Unit = {},
    val onCountryPickerDismiss: () -> Unit = {},
    val onCountryQueryChange: (String) -> Unit = {},
    val onCountrySelect: (CountryOption) -> Unit = {},
    val onBirthDateClick: () -> Unit = {},
    val onSubmit: () -> Unit = {},
    val onChangeNumber: () -> Unit = {},
    val onForgotPassword: () -> Unit = {},
    /** The circular envelope button: swaps between phone and email sign-in. */
    val onToggleMethod: () -> Unit = {},
    val onBackToSignIn: () -> Unit = {},
    val onGoogle: () -> Unit = {},
    val onApple: () -> Unit = {},
    val onHelp: () -> Unit = {},
    val onCreateAccount: () -> Unit = {},
)

@Composable
fun LoginScreen(state: LoginUiState, actions: LoginActions) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AuthColors.Background),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding()
                .verticalScroll(rememberScrollState())
                .padding(AuthDimens.ScreenPadding),
        ) {
            TopBar(state = state, actions = actions)
            VerticalSpace(12)
            AuthContent(state = state, actions = actions)
            VerticalSpace(24)
        }

        if (state.countryPickerOpen) {
            CountryPickerSheet(
                countries = state.filteredCountries,
                query = state.countryQuery,
                onQueryChange = actions.onCountryQueryChange,
                onSelect = actions.onCountrySelect,
                onDismiss = actions.onCountryPickerDismiss,
                searchPlaceholder = stringResource(R.string.auth_search_country),
                emptyLabel = stringResource(R.string.auth_no_countries),
            )
        }
    }
}

@Composable
private fun TopBar(state: LoginUiState, actions: LoginActions) {
    // No back affordance: sign-in is the root of its own task, so there is
    // nowhere to go back to. The hardware/gesture back still finishes the
    // activity via the platform default.
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.End,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LanguageToggle(
            isNorwegian = state.isNorwegian,
            enabled = !state.loading,
            onSelect = actions.onLanguageChange,
        )
    }
}

@Composable
private fun AuthContent(state: LoginUiState, actions: LoginActions) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = stringResource(state.titleRes),
            style = MaterialTheme.typography.headlineLarge,
            textAlign = TextAlign.Center,
        )
        VerticalSpace(10)
        Text(
            text = stringResource(state.subtitleRes),
            color = AuthColors.Muted,
            style = MaterialTheme.typography.bodyLarge,
            textAlign = TextAlign.Center,
        )

        if (state.error != null) {
            VerticalSpace(18)
            ErrorBanner(state.error)
        }

        VerticalSpace(22)
        Fields(state = state, actions = actions)

        VerticalSpace(14)
        PrimaryButton(state = state, onClick = actions.onSubmit)

        if (state.mode == AuthMode.PHONE && state.otpSent) {
            TextLink(
                text = stringResource(R.string.auth_change_number),
                enabled = !state.loading,
                onClick = actions.onChangeNumber,
                color = AuthColors.Primary,
            )
        }
        if (state.mode == AuthMode.RESET) {
            TextLink(
                text = stringResource(R.string.auth_back_to_sign_in),
                enabled = !state.loading,
                onClick = actions.onBackToSignIn,
                color = AuthColors.Primary,
            )
        }
        if (state.showForgotPassword) {
            TextLink(
                text = stringResource(R.string.auth_forgot_password),
                enabled = !state.loading,
                onClick = actions.onForgotPassword,
                color = AuthColors.Primary,
            )
        }

        if (state.showSocialButtons) {
            VerticalSpace(18)
            SocialRow(state = state, actions = actions)
        }

        if (state.showBottomLinks) {
            VerticalSpace(10)
            Row(
                horizontalArrangement = Arrangement.spacedBy(24.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                TextLink(
                    text = stringResource(R.string.auth_need_help),
                    enabled = !state.loading,
                    onClick = actions.onHelp,
                )
                TextLink(
                    text = stringResource(
                        if (state.mode == AuthMode.SIGN_UP) R.string.auth_sign_in_link
                        else R.string.auth_create_account,
                    ),
                    enabled = !state.loading,
                    onClick = actions.onCreateAccount,
                )
            }
        }
    }
}

@Composable
private fun Fields(state: LoginUiState, actions: LoginActions) {
    Column(
        modifier = Modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (state.showPhoneFields) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                CountryButton(
                    country = state.country,
                    enabled = state.phoneEditable,
                    onClick = actions.onCountryPickerOpen,
                    contentDescription = stringResource(R.string.auth_country_code),
                )
                AuthTextField(
                    value = state.phone,
                    onValueChange = actions.onPhoneChange,
                    placeholder = stringResource(R.string.auth_phone_number),
                    enabled = state.phoneEditable,
                    keyboardType = KeyboardType.Phone,
                    imeAction = ImeAction.Done,
                    onImeAction = actions.onSubmit,
                    modifier = Modifier.weight(1f),
                )
            }
        }

        if (state.showOtpField) {
            AuthTextField(
                value = state.otp,
                onValueChange = actions.onOtpChange,
                placeholder = stringResource(R.string.auth_otp_hint),
                enabled = !state.loading,
                keyboardType = KeyboardType.NumberPassword,
                imeAction = ImeAction.Done,
                onImeAction = actions.onSubmit,
            )
        }

        if (state.showNameFields) {
            AuthTextField(
                value = state.fullName,
                onValueChange = actions.onFullNameChange,
                placeholder = stringResource(R.string.auth_full_name),
                enabled = !state.loading,
            )
            AuthPickerField(
                value = state.dateOfBirthLabel,
                placeholder = stringResource(R.string.auth_date_of_birth),
                enabled = !state.loading,
                onClick = actions.onBirthDateClick,
            )
        }

        if (state.showEmailField) {
            AuthTextField(
                value = state.email,
                onValueChange = actions.onEmailChange,
                placeholder = stringResource(R.string.auth_email_hint),
                enabled = !state.loading,
                keyboardType = KeyboardType.Email,
                imeAction = if (state.mode == AuthMode.RESET) ImeAction.Done else ImeAction.Next,
                onImeAction = actions.onSubmit,
            )
        }

        if (state.showPasswordField) {
            AuthTextField(
                value = state.password,
                onValueChange = actions.onPasswordChange,
                placeholder = stringResource(R.string.auth_password),
                enabled = !state.loading,
                keyboardType = KeyboardType.Password,
                isPassword = true,
                imeAction = if (state.showConfirmPassword) ImeAction.Next else ImeAction.Done,
                onImeAction = actions.onSubmit,
            )
        }

        if (state.showConfirmPassword) {
            AuthTextField(
                value = state.confirmPassword,
                onValueChange = actions.onConfirmPasswordChange,
                placeholder = stringResource(R.string.auth_confirm_password),
                enabled = !state.loading,
                keyboardType = KeyboardType.Password,
                isPassword = true,
                imeAction = ImeAction.Done,
                onImeAction = actions.onSubmit,
            )
        }
    }
}

@Composable
private fun PrimaryButton(state: LoginUiState, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        enabled = !state.loading,
        shape = RoundedCornerShape(AuthDimens.FieldCorner),
        colors = ButtonDefaults.buttonColors(
            containerColor = AuthColors.Primary,
            contentColor = AuthColors.OnPrimary,
            disabledContainerColor = AuthColors.Primary.copy(alpha = 0.5f),
            disabledContentColor = AuthColors.OnPrimary.copy(alpha = 0.8f),
        ),
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 56.dp),
    ) {
        if (state.loading) {
            CircularProgressIndicator(
                color = AuthColors.OnPrimary,
                strokeWidth = 2.dp,
                modifier = Modifier.size(18.dp),
            )
            HorizontalSpace(10)
        }
        Text(
            text = stringResource(state.primaryButtonRes),
            fontSize = 17.sp,
            fontWeight = FontWeight.Bold,
        )
    }
}

@Composable
private fun SocialRow(state: LoginUiState, actions: LoginActions) {
    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        // Letterforms rather than the official Google and Apple marks: those
        // are brand assets with their own usage rules, and the XML screen used
        // the same glyphs. Swap in the licensed vectors before store release.
        CircleActionButton(
            contentDescription = stringResource(R.string.auth_google),
            enabled = !state.loading,
            onClick = actions.onGoogle,
        ) {
            Text("G", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = AuthColors.Text)
        }
        CircleActionButton(
            contentDescription = stringResource(R.string.auth_apple),
            enabled = !state.loading,
            onClick = actions.onApple,
        ) {
            Text("A", fontSize = 22.sp, fontWeight = FontWeight.Bold, color = AuthColors.Text)
        }
        CircleActionButton(
            contentDescription = stringResource(
                if (state.mode == AuthMode.PHONE) R.string.auth_email else R.string.auth_phone,
            ),
            enabled = !state.loading,
            onClick = actions.onToggleMethod,
        ) {
            // The icon shows the method the tap will switch *to*, so it flips
            // to a handset once the user is already on email.
            Icon(
                imageVector = if (state.mode == AuthMode.PHONE) Icons.Filled.Email
                else Icons.Filled.Phone,
                contentDescription = null,
                tint = AuthColors.Text,
            )
        }
    }
}
