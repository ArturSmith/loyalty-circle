# Native apps (Capacitor)

Most app screens use a native shell around the live site. Android also has
local Kotlin/Compose login, loading, and offline screens. The apps do
**not** bundle the web build: `capacitor.config.ts` sets
`server.url = "https://clubcarder.com"`, so the WebView loads production
directly and every deploy ships to the apps instantly — no store review needed
for web UI changes. Android native changes require rebuilding and installing
the APK (or distributing a new store build); publishing the website is not enough.

`capacitor-shell/` contains the minimal local web assets (`webDir`). Android's
offline experience is native, not that placeholder page.

## Android startup and offline behavior

- Without a saved session, `MainActivity.load()` opens native `LoginActivity`
  before constructing the Capacitor bridge or requesting the website. The
  login form can therefore render without internet.
- A saved access/refresh-token pair opens the web app behind a native loading
  screen. An expired access token still counts as a saved session: the web auth
  client refreshes it when online.
- No validated internet connection, a main-document network failure, or a
  main-document HTTP error shows a native Retry screen instead of Android's
  webpage error. Failed images/subresources do not replace a working page.
- Retry reloads the last trusted app URL. Network failures never clear the
  saved session. Signing in, sending OTPs, OAuth, and loading wallet data still
  require internet; this is not an offline wallet cache.

`NativeSessionStore` reads the same `CapacitorStorage` Preferences session as
the web auth adapter and native login. `ACCESS_NETWORK_STATE` lets Android
detect connectivity without prompting for a runtime permission.

Build and run the JVM tests with `./gradlew :app:testDebugUnitTest` in `android/`.
`OfflineStartupTest` also covers offline signed-out startup, expired-session
preservation, and Retry recovery with an intercepted local HTML response (no
real account). Run it **only on a disposable emulator**, since it toggles Wi-Fi
and mobile data:

```sh
cd android
./gradlew :app:connectedDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.clubcarder.app.OfflineStartupTest
```

## Requirements

| Tool | Version |
| --- | --- |
| JDK | **21** (Capacitor 8 requires it) |
| Android Studio | Ladybug or newer |
| Xcode | 16+ |

macOS already has a JDK 21 inside Android Studio. If `./gradlew` fails with
`invalid source release: 21`, point Gradle at it:

```sh
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
```

## Everyday commands

```sh
npm run cap:sync       # copy config + plugins into ios/ and android/
npm run cap:android    # sync, then open Android Studio
npm run cap:ios        # sync, then open Xcode
```

Because the shell loads the remote site, you only need to re-sync when the
Capacitor config or a plugin changes — not on every code change.

To test against a local dev server, temporarily set in `capacitor.config.ts`:

```ts
server: { url: "http://192.168.x.x:3000", cleartext: true }
```

(use your LAN IP, not `localhost`), then `npm run cap:sync`.

## Build a debug APK

```sh
cd android
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
  ./gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

## Native wiring

`src/lib/native.ts` (`initNative`, called from `src/routes/__root.tsx`) provides
the web-side native integration. It no-ops on the web and handles:

- status bar style and hiding the splash screen
- the Android hardware back button (mapped to history, exits at the root)
- deep links (`appUrlOpen` → router navigation)
- adding the `capacitor-native` class to `<html>`

That class drives the native-only CSS at the bottom of `src/styles.css`
(safe-area insets, no tap highlight, no rubber-band overscroll).

`hapticTap()` from the same module gives light haptic feedback; it's a no-op on
the web, so it's safe to call anywhere.

## Permissions

QR scanning uses `getUserMedia` inside the WebView, which needs native
permissions declared:

- Android — `CAMERA` in `android/app/src/main/AndroidManifest.xml`
- iOS — `NSCameraUsageDescription` in `ios/App/App/Info.plist`

Capacitor regenerates neither file on sync, but they are easy to lose if a
platform is ever removed and re-added — re-apply them if scanning breaks.

## Deep links (not yet enabled)

`appUrlOpen` is already handled in `initNative`. To make QR codes
(`https://clubcarder.com/b/<id>`) open the app instead of the browser:

1. Android — add an `intent-filter` with `android:autoVerify="true"` for the
   host, and host `/.well-known/assetlinks.json`.
2. iOS — enable Associated Domains (`applinks:clubcarder.com`) and host
   `/.well-known/apple-app-site-association`.
