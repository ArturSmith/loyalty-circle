package com.clubcarder.app

import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.ComposeView
import androidx.compose.ui.platform.ViewCompositionStrategy
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import com.clubcarder.app.auth.AuthColors
import com.clubcarder.app.auth.AuthTheme

/** Local UI above the WebView. It does not need a website or a valid access token. */
class NativeLoadOverlay(activity: AppCompatActivity, onRetry: Runnable) {
    private enum class State { LOADING, OFFLINE, ERROR }
    private var state by mutableStateOf(State.LOADING)

    init {
        // Establish the light native startup theme before any web script runs.
        // The web app can take over the status-bar theme once it has loaded.
        WindowCompat.getInsetsController(activity.window, activity.window.decorView).apply {
            isAppearanceLightStatusBars = true
            isAppearanceLightNavigationBars = true
        }
        @Suppress("DEPRECATION")
        activity.window.statusBarColor = AuthColors.Background.toArgb()
        @Suppress("DEPRECATION")
        activity.window.navigationBarColor = AuthColors.Background.toArgb()
    }

    val view = ComposeView(activity).apply {
        setViewCompositionStrategy(ViewCompositionStrategy.DisposeOnViewTreeLifecycleDestroyed)
        setContent {
            AuthTheme {
                Box(
                    modifier = Modifier.fillMaxSize().background(AuthColors.Background).safeDrawingPadding(),
                    contentAlignment = Alignment.Center,
                ) {
                    Column(
                        modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth()
                            .verticalScroll(rememberScrollState()).padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(20.dp),
                    ) {
                        Text(stringResource(R.string.app_name), fontSize = 28.sp, fontWeight = FontWeight.Bold)
                        if (state == State.LOADING) {
                            CircularProgressIndicator()
                            Text(stringResource(R.string.app_loading), textAlign = TextAlign.Center)
                        } else {
                            Text(
                                stringResource(if (state == State.OFFLINE) R.string.app_offline_title else R.string.app_load_error_title),
                                fontSize = 22.sp, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.Center,
                            )
                            Text(
                                stringResource(if (state == State.OFFLINE) R.string.app_offline_message else R.string.app_load_error_message),
                                color = AuthColors.Muted, textAlign = TextAlign.Center,
                            )
                            Button(
                                onClick = { onRetry.run() },
                                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                                shape = RoundedCornerShape(16.dp),
                            ) { Text(stringResource(R.string.app_retry)) }
                        }
                    }
                }
            }
        }
    }

    fun showLoading() { state = State.LOADING; view.visibility = View.VISIBLE; view.bringToFront() }
    fun showError(offline: Boolean) {
        state = if (offline) State.OFFLINE else State.ERROR
        view.visibility = View.VISIBLE
        view.bringToFront()
    }
    fun hide() { view.visibility = View.GONE }
}
