# Metronome

A drift-free metronome for iOS and Android, built with Expo and TypeScript.

Clicks are scheduled ahead of time against `AudioContext.currentTime`, the audio hardware's
own sample-accurate clock, rather than fired from a JS timer — see `.claude/skills/metronome-timing`
for why that distinction is the whole ballgame.

## Requirements

`react-native-audio-api` is a native module, so **this app does not run in Expo Go**.
You need a development build.

```bash
npm install
npx expo run:ios      # or: npx expo run:android
```

`npm start` alone only starts the bundler; it needs a dev build already installed.

### Running on an emulator

The default debug build produces **arm64-v8a only**, so it installs on an x86_64 emulator
but dies immediately with `SoLoaderDSONotFoundError: couldn't find DSO to load:
libreactnative.so`. Build both architectures instead:

```bash
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
adb -s emulator-5554 install --abi x86_64 -r -d app/build/outputs/apk/debug/app-debug.apk
```

`--abi x86_64` is not optional once the APK is a fat one. The system images translate arm,
so the installer happily extracts `lib/arm64-v8a` onto an x86_64 emulator and the app dies
with the same `SoLoaderDSONotFoundError` as an arm-only build — the ABI in the error is
the one that got *extracted*, not the one that is missing.

### The project path must be plain ASCII

`expo prebuild` fails with `Project file "MainApplication" does not exist` when the path
contains non-ASCII characters (it silently copies no Android template). The same command
succeeds from an ASCII path. Keep the project somewhere like `C:\dev\...`, not under a
localised folder name such as `Masaüstü`.

### Gradle needs Unix tools on PATH (Windows)

`react-native-audio-api` downloads prebuilt binaries with a shell script. Without
`mkdir`/`rm`/`unzip` on PATH the download directory is never created and curl fails with
`error 23`, failing `:react-native-audio-api:downloadPrebuiltBinaries`. Prepend Git's
tools before building:

```
C:\Program Files\Git\usr\bin;C:\Program Files\Git\mingw64\bin
```

### adb keeps the release APK open (Windows)

After `adb install`, the adb server holds a handle on `app-release.apk`. The next
`assembleRelease` then fails in `:app:packageRelease` with `Unable to delete directory`,
and nothing else on the machine will delete the file either. `adb kill-server` releases it
— at the cost of dropping the device, which has to be reconnected and may re-prompt for
USB debugging.

### Testing audio playback is awkward

Starting the metronome takes Android audio focus with `GAIN`, which stops whatever else is
playing — including any test tone you started on the same device. Test signals have to come
from a separate device.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests — meters, subdivisions, tap tempo, scheduler drift. No device needed. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run ios` / `npm run android` | Build and launch a development build |

## Layout

```
app/                     expo-router screens (default exports — the router requires them)
  index.tsx              Metronome
  settings.tsx           Appearance, language and behaviour
src/
  audio/       engine.ts — owns the AudioContext and the iOS session
  i18n/        English and Turkish strings; the dictionary shape is type-checked
  metronome/   patterns, scheduler, clickSynth, tempoTerms, useMetronome
  settings/    persisted settings store
  ui/          shared components
  theme/       palette, spacing, type scale
```

The scheduler is an injectable class with no React or native dependencies — it takes a
clock — which is why its drift guarantees are covered by tests that run in Node.

## Background

`.claude/skills/` holds the reference this was built from: drift-free scheduling and tempo
conventions, the react-native-audio-api platform plumbing, and mobile UI/UX design rules.
