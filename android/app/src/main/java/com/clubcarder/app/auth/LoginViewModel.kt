package com.clubcarder.app.auth

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel

/**
 * Holds the sign-in form.
 *
 * A ViewModel rather than plain activity fields because LoginActivity does not
 * declare `configChanges`, so it is recreated on rotation — and switching
 * language recreates it deliberately. The XML screen got away with activity
 * fields only because EditText saves its own text; a Compose screen driven by
 * activity state would have lost a half-typed phone number on both.
 */
class LoginViewModel : ViewModel() {
    var state by mutableStateOf(LoginUiState())
        private set

    fun setCountries(countries: List<CountryOption>, defaultRegion: String) {
        val preferred = countries.firstOrNull { it.region.equals(defaultRegion, true) }
        state = state.copy(
            countries = countries,
            country = state.country ?: preferred ?: countries.firstOrNull(),
        )
    }

    fun setLanguage(isNorwegian: Boolean) {
        state = state.copy(isNorwegian = isNorwegian)
    }

    /**
     * Switching mode clears the credentials but keeps the phone number and
     * email: someone bouncing to "forgot password" and back should not have to
     * retype the address they just entered.
     */
    fun setMode(mode: AuthMode) {
        state = state.copy(
            mode = mode,
            otpSent = false,
            otp = "",
            password = "",
            confirmPassword = "",
            error = null,
        )
    }

    fun setLoading(loading: Boolean) {
        state = state.copy(loading = loading)
    }

    fun onOtpSent() {
        state = state.copy(otpSent = true, loading = false, error = null)
    }

    fun changeNumber() {
        state = state.copy(otpSent = false, otp = "", error = null)
    }

    fun showError(message: String) {
        state = state.copy(error = message, loading = false)
    }

    fun clearError() {
        if (state.error != null) state = state.copy(error = null)
    }

    fun openCountryPicker() {
        state = state.copy(countryPickerOpen = true, countryQuery = "")
    }

    fun dismissCountryPicker() {
        state = state.copy(countryPickerOpen = false, countryQuery = "")
    }

    fun selectCountry(option: CountryOption) {
        state = state.copy(country = option, countryPickerOpen = false, countryQuery = "")
    }

    fun setCountryQuery(query: String) {
        state = state.copy(countryQuery = query)
    }

    // Typing anywhere clears a stale error: leaving the previous failure on
    // screen while the user fixes the field reads as though it failed again.
    fun setPhone(value: String) {
        state = state.copy(phone = value, error = null)
    }

    fun setOtp(value: String) {
        state = state.copy(otp = value.filter(Char::isDigit).take(8), error = null)
    }

    fun setFullName(value: String) {
        state = state.copy(fullName = value, error = null)
    }

    fun setDateOfBirth(isoDate: String) {
        state = state.copy(dateOfBirth = isoDate, error = null)
    }

    fun setEmail(value: String) {
        state = state.copy(email = value, error = null)
    }

    fun setPassword(value: String) {
        state = state.copy(password = value, error = null)
    }

    fun setConfirmPassword(value: String) {
        state = state.copy(confirmPassword = value, error = null)
    }
}
