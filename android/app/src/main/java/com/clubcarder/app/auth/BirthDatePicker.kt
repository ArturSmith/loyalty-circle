package com.clubcarder.app.auth

import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDefaults
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SelectableDates
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.res.stringResource
import com.clubcarder.app.R
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone

/**
 * Date of birth.
 *
 * Replaces the platform DatePickerDialog with the Material 3 one so the sheet
 * matches the rest of the screen. Values are exchanged as ISO yyyy-MM-dd:
 * the picker works in UTC millis, and formatting only for display keeps a
 * device in, say, UTC-5 from shifting the stored date back a day.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BirthDatePickerDialog(
    initialIsoDate: String,
    onDismiss: () -> Unit,
    onSelect: (isoDate: String) -> Unit,
) {
    val todayUtc = remember { startOfTodayUtc() }

    val initialMillis = remember(initialIsoDate) {
        parseIsoAsUtcMillis(initialIsoDate)
            // Nobody signing up is born today; open at a plausible age so the
            // picker does not start 25 years of scrolling away.
            ?: Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
                timeInMillis = todayUtc
                add(Calendar.YEAR, -25)
            }.timeInMillis
    }

    val pickerState = rememberDatePickerState(
        initialSelectedDateMillis = initialMillis,
        selectableDates = object : SelectableDates {
            override fun isSelectableDate(utcTimeMillis: Long) = utcTimeMillis <= todayUtc
            override fun isSelectableYear(year: Int) =
                year <= Calendar.getInstance().get(Calendar.YEAR)
        },
    )

    DatePickerDialog(
        onDismissRequest = onDismiss,
        colors = DatePickerDefaults.colors(containerColor = AuthColors.Card),
        confirmButton = {
            TextButton(
                onClick = {
                    val millis = pickerState.selectedDateMillis
                    if (millis != null) onSelect(formatUtcMillisAsIso(millis)) else onDismiss()
                },
            ) {
                Text(stringResource(R.string.auth_confirm), color = AuthColors.Primary)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(stringResource(R.string.auth_cancel), color = AuthColors.Muted)
            }
        },
    ) {
        DatePicker(
            state = pickerState,
            title = {
                Text(
                    text = stringResource(R.string.auth_select_birth_date),
                    color = AuthColors.Text,
                )
            },
            colors = DatePickerDefaults.colors(containerColor = AuthColors.Card),
        )
    }
}

private fun utcFormatter() = SimpleDateFormat("yyyy-MM-dd", Locale.ROOT).apply {
    timeZone = TimeZone.getTimeZone("UTC")
}

private fun parseIsoAsUtcMillis(isoDate: String): Long? {
    if (isoDate.isEmpty()) return null
    return runCatching { utcFormatter().parse(isoDate)?.time }.getOrNull()
}

private fun formatUtcMillisAsIso(millis: Long): String = utcFormatter().format(millis)

private fun startOfTodayUtc(): Long {
    val calendar = Calendar.getInstance(TimeZone.getTimeZone("UTC"))
    calendar.set(Calendar.HOUR_OF_DAY, 0)
    calendar.set(Calendar.MINUTE, 0)
    calendar.set(Calendar.SECOND, 0)
    calendar.set(Calendar.MILLISECOND, 0)
    return calendar.timeInMillis
}
