# Native apps (Capacitor)

The iOS and Android apps are thin native shells around the live site. They do
**not** bundle the web build: `capacitor.config.ts` sets
`server.url = "https://clubcarder.com"`, so the WebView loads production
directly and every deploy ships to the apps instantly — no store review needed
for UI changes.

`capacitor-shell/` only contains an offline fallback page (`webDir`).

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

`src/lib/native.ts` (`initNative`, called from `src/routes/__root.tsx`) is the
single place native behaviour lives. It no-ops on the web and handles:

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
