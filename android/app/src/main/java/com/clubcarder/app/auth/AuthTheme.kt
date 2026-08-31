package com.clubcarder.app.auth

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * Design tokens for the native sign-in screen.
 *
 * These mirror res/values/auth_colors.xml rather than replacing it: the splash
 * screen and the status bar are still styled from XML, so the two must agree.
 * Duplicated deliberately — Compose cannot read an XML colour without a
 * Context, and threading one through every composable to save nine constants
 * is a poor trade.
 */
object AuthColors {
    val Background = Color(0xFFF5F6F8)
    val Card = Color(0xFFFFFFFF)
    val Text = Color(0xFF18202C)
    val Muted = Color(0xFF7C8797)
    val Border = Color(0xFFE3E7EC)
    val Input = Color(0xFFF7F8FA)
    val Primary = Color(0xFF3583F5)
    val OnPrimary = Color(0xFFFFFFFF)
    val Error = Color(0xFFC62828)
    val ErrorBackground = Color(0xFFFFF1F1)
}

object AuthDimens {
    val FieldCorner = 16.dp
    val ScreenPadding = 20.dp
    val CardPadding = 24.dp
    /** Android's minimum comfortable touch target. */
    val TouchTarget = 48.dp
}

private val AuthColorScheme = lightColorScheme(
    primary = AuthColors.Primary,
    onPrimary = AuthColors.OnPrimary,
    background = AuthColors.Background,
    onBackground = AuthColors.Text,
    surface = AuthColors.Card,
    onSurface = AuthColors.Text,
    outline = AuthColors.Border,
    error = AuthColors.Error,
    onError = AuthColors.OnPrimary,
)

private val AuthTypography = Typography(
    headlineLarge = TextStyle(
        fontSize = 32.sp,
        lineHeight = 38.sp,
        fontWeight = FontWeight.ExtraBold,
        color = AuthColors.Text,
    ),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelLarge = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.SemiBold),
)

/**
 * The sign-in screen is intentionally light-only. It renders over a fixed
 * light splash and the web app it hands off to has no dark theme yet, so
 * following the system here would produce a dark screen sandwiched between
 * two light ones.
 */
@Composable
fun AuthTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AuthColorScheme,
        typography = AuthTypography,
        content = content,
    )
}
