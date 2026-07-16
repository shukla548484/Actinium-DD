# Actinium DD Mobile

Android-first Expo React Native client for vessel crews.

## What it does

- Stores job drafts and machinery condition reports in local SQLite
- Captures ship/job/machinery photos with the device camera
- Queues offline changes and uploads them to the platform when online
- Uses the platform mobile auth endpoint and bearer-token sync APIs

## Run in development

From the repo root:

```bash
npm run dev
npm run mobile:start
```

Then either:

```bash
npm run mobile:android
```

or scan the Expo QR code in Expo Go.

## Important login note

Use the platform LAN URL on the phone, for example:

```text
http://192.168.1.20:3000
```

Do not use `localhost` on a physical Android device unless the server is running on that same device.

## Build Android debug APK locally

Prerequisites:

- Java 21
- Android SDK installed
- `ANDROID_HOME` or `ANDROID_SDK_ROOT` pointing to the SDK
- Android platform tools available (`adb`)

Alternative to env vars:

- copy `mobile/android/local.properties.example` to `mobile/android/local.properties`
- set `sdk.dir` to your Android SDK path

Build:

```bash
npm run mobile:apk:debug
```

The command now checks for Android SDK configuration before Gradle starts, so it fails with a clear setup message instead of a long Gradle stack trace.

Expected output:

```text
mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

## Build installable APK with EAS

Inside `mobile/`:

```bash
npm run android:eas-preview
```

That profile is configured in [eas.json](file:///Users/akhileshshukla/Documents/Documents/GitHub/Actinium-DD/mobile/eas.json) to produce an internal-distribution APK.

From repo root you can also run:

```bash
npm run mobile:eas:apk
```

Before running EAS builds, authenticate once:

```bash
cd mobile
npx eas login
```

Or set `EXPO_TOKEN` for non-interactive usage.
