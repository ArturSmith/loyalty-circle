package com.clubcarder.app.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LocalTextStyle
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/**
 * A rounded, filled input matching the web sign-in form.
 *
 * Material3's TextField was not used: it renders a floating label and an
 * indicator line that the design does not have, and stripping those back costs
 * more than drawing the box.
 */
@Composable
fun AuthTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    keyboardType: KeyboardType = KeyboardType.Text,
    imeAction: ImeAction = ImeAction.Next,
    onImeAction: () -> Unit = {},
    isPassword: Boolean = false,
    singleLine: Boolean = true,
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(AuthColors.Input, RoundedCornerShape(AuthDimens.FieldCorner))
            .border(1.dp, AuthColors.Border, RoundedCornerShape(AuthDimens.FieldCorner))
            .heightIn(min = 56.dp)
            .padding(horizontal = 18.dp),
        contentAlignment = Alignment.CenterStart,
    ) {
        if (value.isEmpty()) {
            Text(text = placeholder, color = AuthColors.Muted, fontSize = 16.sp)
        }
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            enabled = enabled,
            singleLine = singleLine,
            textStyle = LocalTextStyle.current.copy(
                color = if (enabled) AuthColors.Text else AuthColors.Muted,
                fontSize = 16.sp,
            ),
            cursorBrush = SolidColor(AuthColors.Primary),
            visualTransformation =
                if (isPassword) PasswordVisualTransformation() else VisualTransformation.None,
            keyboardOptions = KeyboardOptions(
                keyboardType = keyboardType,
                imeAction = imeAction,
            ),
            keyboardActions = KeyboardActions(
                onDone = { onImeAction() },
                onGo = { onImeAction() },
                onNext = { onImeAction() },
            ),
            modifier = Modifier.fillMaxWidth(),
        )
    }
}

/** A read-only field that opens something on tap, such as the date picker. */
@Composable
fun AuthPickerField(
    value: String,
    placeholder: String,
    enabled: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .background(AuthColors.Input, RoundedCornerShape(AuthDimens.FieldCorner))
            .border(1.dp, AuthColors.Border, RoundedCornerShape(AuthDimens.FieldCorner))
            .clickable(enabled = enabled, onClick = onClick)
            .heightIn(min = 56.dp)
            .padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = value.ifEmpty { placeholder },
            color = if (value.isEmpty()) AuthColors.Muted else AuthColors.Text,
            fontSize = 16.sp,
            modifier = Modifier.weight(1f),
        )
        Icon(
            imageVector = Icons.Filled.ArrowDropDown,
            contentDescription = null,
            tint = AuthColors.Muted,
        )
    }
}

/** The compact country button that sits to the left of the phone field. */
@Composable
fun CountryButton(
    country: CountryOption?,
    enabled: Boolean,
    onClick: () -> Unit,
    contentDescription: String,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier = modifier
            .background(AuthColors.Input, RoundedCornerShape(AuthDimens.FieldCorner))
            .border(1.dp, AuthColors.Border, RoundedCornerShape(AuthDimens.FieldCorner))
            .clickable(enabled = enabled, onClickLabel = contentDescription, onClick = onClick)
            .heightIn(min = 56.dp)
            .padding(start = 14.dp, end = 6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text = country?.dialLabel ?: "—",
            color = if (enabled) AuthColors.Text else AuthColors.Muted,
            fontSize = 16.sp,
        )
        Icon(
            imageVector = Icons.Filled.ArrowDropDown,
            contentDescription = null,
            tint = AuthColors.Muted,
            modifier = Modifier.size(24.dp),
        )
    }
}

/**
 * Country selection.
 *
 * Replaces a Spinner holding every calling code on earth, which offered no way
 * to search: reaching Norway meant scrolling past roughly a hundred entries.
 * The list is filtered by name, dialling code or ISO region.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CountryPickerSheet(
    countries: List<CountryOption>,
    query: String,
    onQueryChange: (String) -> Unit,
    onSelect: (CountryOption) -> Unit,
    onDismiss: () -> Unit,
    searchPlaceholder: String,
    emptyLabel: String,
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = AuthColors.Card,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = AuthDimens.CardPadding)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AuthTextField(
                value = query,
                onValueChange = onQueryChange,
                placeholder = searchPlaceholder,
                imeAction = ImeAction.Search,
            )

            if (countries.isEmpty()) {
                Text(
                    text = emptyLabel,
                    color = AuthColors.Muted,
                    modifier = Modifier.padding(vertical = 24.dp),
                )
            } else {
                LazyColumn(modifier = Modifier.heightIn(max = 420.dp)) {
                    items(countries, key = { it.region }) { option ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSelect(option) },
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 14.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(text = option.flag, fontSize = 20.sp)
                                HorizontalSpace(12)
                                Text(
                                    text = option.name,
                                    color = AuthColors.Text,
                                    fontSize = 16.sp,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = "+${option.callingCode}",
                                    color = AuthColors.Muted,
                                    fontWeight = FontWeight.SemiBold,
                                    fontSize = 15.sp,
                                )
                            }
                            HorizontalDivider(color = AuthColors.Border)
                        }
                    }
                }
            }
        }
    }
}
