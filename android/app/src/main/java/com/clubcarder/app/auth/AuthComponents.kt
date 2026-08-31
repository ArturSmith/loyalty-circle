package com.clubcarder.app.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * The infinity flourish used across the web app, so the native screen and the
 * WebView it hands off to look like the same product.
 */
@Composable
fun OrnamentDivider(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth().clearAndSetSemantics { },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center,
    ) {
        HorizontalDivider(modifier = Modifier.weight(1f), color = AuthColors.Border)
        Text(
            text = "\u221E",
            color = AuthColors.Muted,
            fontSize = 16.sp,
            modifier = Modifier.padding(horizontal = 10.dp).alpha(0.7f),
        )
        HorizontalDivider(modifier = Modifier.weight(1f), color = AuthColors.Border)
    }
}

/**
 * A two-option language switch.
 *
 * Written as a single control with two halves rather than two buttons, so
 * screen readers announce the selected state instead of two unrelated taps.
 */
@Composable
fun LanguageToggle(
    isNorwegian: Boolean,
    enabled: Boolean,
    onSelect: (norwegian: Boolean) -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .background(AuthColors.Card, CircleShape)
            .border(1.dp, AuthColors.Border, CircleShape)
            .padding(3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LanguageOption("EN", selected = !isNorwegian, enabled = enabled) { onSelect(false) }
        LanguageOption("NO", selected = isNorwegian, enabled = enabled) { onSelect(true) }
    }
}

@Composable
private fun LanguageOption(
    label: String,
    selected: Boolean,
    enabled: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .background(if (selected) AuthColors.Primary else Color.Transparent, CircleShape)
            .clickable(enabled = enabled && !selected, onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        Text(
            text = label,
            color = if (selected) AuthColors.OnPrimary else AuthColors.Muted,
            fontWeight = FontWeight.SemiBold,
            fontSize = 14.sp,
        )
    }
}

/** A circular icon button, as used for the third-party sign-in options. */
@Composable
fun CircleActionButton(
    contentDescription: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Box(
        modifier = modifier
            .size(56.dp)
            .background(AuthColors.Card, CircleShape)
            .border(1.dp, AuthColors.Border, CircleShape)
            .clickable(enabled = enabled, onClickLabel = contentDescription, onClick = onClick)
            .alpha(if (enabled) 1f else 0.5f),
        contentAlignment = Alignment.Center,
    ) {
        content()
    }
}

/**
 * A message the user must read before continuing.
 *
 * The XML version hid this in a TextView far above the fold, so an error
 * raised after scrolling was invisible; the activity had to call
 * `requestFocus()` on the scroll view to drag attention back. Here it sits
 * directly above the action that failed.
 */
@Composable
fun ErrorBanner(message: String, modifier: Modifier = Modifier) {
    Text(
        text = message,
        color = AuthColors.Error,
        style = MaterialTheme.typography.bodyMedium,
        textAlign = TextAlign.Start,
        modifier = modifier
            .fillMaxWidth()
            .background(AuthColors.ErrorBackground, RoundedCornerShape(12.dp))
            .border(1.dp, AuthColors.Error.copy(alpha = 0.25f), RoundedCornerShape(12.dp))
            .padding(horizontal = 14.dp, vertical = 10.dp),
    )
}

/** A text link that keeps a full-size touch target without looking like one. */
@Composable
fun TextLink(
    text: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    color: Color = AuthColors.Text,
) {
    Text(
        text = text,
        color = if (enabled) color else AuthColors.Muted,
        style = LocalTextStyle.current.copy(fontWeight = FontWeight.SemiBold, fontSize = 15.sp),
        modifier = modifier
            .clickable(enabled = enabled, onClick = onClick)
            .padding(vertical = 12.dp),
    )
}

@Composable
fun VerticalSpace(height: Int) {
    Spacer(Modifier.height(height.dp))
}

@Composable
fun HorizontalSpace(width: Int) {
    Spacer(Modifier.width(width.dp))
}
