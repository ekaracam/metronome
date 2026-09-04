---
name: rn-audio-stack
description: react-native-audio-api setup and platform plumbing for an Expo metronome — config plugin options, Android permissions, the AudioContext clock that drives scheduling, iOS audio session categories, background playback, and interruption handling. Use when wiring the audio engine, configuring app.json for a development build, or debugging silent output, wrong routing, or clicks that stop when the app backgrounds.
---

# React Native audio stack (Expo + react-native-audio-api)

The metronome needs exactly one thing from this library: a Web Audio–compatible clock.
`AudioContext.currentTime` is sample-accurate, which is what lets clicks be scheduled ahead
of time instead of fired from a JS timer — see the `metronome-timing` skill for the
scheduler itself.

> **This app cannot run in Expo Go.** `react-native-audio-api` is a native module.
> Use a development build: `npx expo run:ios` / `npx expo run:android`.

## Expo config plugin

In `app.json`:

```json
{
  "plugins": [
    [
      "react-native-audio-api",
      {
        "iosBackgroundMode": true,
        "androidPermissions": [
          "android.permission.MODIFY_AUDIO_SETTINGS",
          "android.permission.FOREGROUND_SERVICE",
          "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"
        ],
        "androidForegroundService": true,
        "androidFSTypes": ["mediaPlayback"]
      }
    ]
  ]
}
```

Plugin options: `iosBackgroundMode` (bool, default true — sets `UIBackgroundModes: ["audio"]`),
`iosMicrophonePermission` (string → `NSMicrophoneUsageDescription`, not needed here),
`androidPermissions` (array), `androidForegroundService` (bool, default true),
`androidFSTypes` (`"mediaPlayback"` | `"microphone"`).

⚠️ **`androidPermissions` replaces the list; it does not extend a default.** Whatever you
list is exactly what the manifest gets, and `androidFSTypes` does not imply the matching
permission — you must name it yourself. Verified on 0.13.2 the hard way, in the other
direction: a missing entry produced an APK where the runtime request failed with
`SecurityException: Package ... has not requested permission ...` and no system dialog ever
appeared. Ask for nothing you do not use, and check what you actually got.

After changing plugin options you must **re-run prebuild and rebuild the native project** —
a JS reload will not pick it up. Confirm in `android/app/src/main/AndroidManifest.xml`
before blaming runtime code.

## AudioContext

```ts
import { AudioContext } from 'react-native-audio-api';

const ctx = new AudioContext();
ctx.currentTime;   // sample-accurate seconds, drives the scheduler
```

Create it **lazily on first use**, not at module load — an AudioContext created at import
time holds the audio session open and drains battery before the user has pressed anything.

Constructing it is a synchronous native call that opens an output stream, so it can block
for a hundred milliseconds or more. Do that on a screen transition, never inside the
handler for the button the user just pressed.

## iOS session category

The metronome only plays, so it wants `playback` and nothing else:

```ts
AudioManager.setAudioSessionOptions({
  iosCategory: 'playback',
  iosMode: 'default',
  iosOptions: ['allowAirPlay', 'allowBluetoothA2DP'],
});
await AudioManager.setAudioSessionActivity(true);
```

Resist `playAndRecord` unless something genuinely records: it routes output to the
**earpiece rather than the speaker** unless `defaultToSpeaker` is set, and the symptom —
"the metronome went quiet after I used the other screen" — costs an afternoon to trace.

Design rule: **a single `src/audio/engine.ts` owns the context and the session.** No
component touches `AudioManager` directly. Two callers fighting over the session is a class
of bug that only appears on device.

## Audio focus stops other apps (Android)

Activating the session requests audio focus with `GAIN`, which tells Android to stop
whatever else is playing. That is correct for a metronome, but it also means **the app will
silence any audio you were using to test it** — including a tone you were playing from the
device's own music app to exercise the microphone or the speaker. Test signals have to come
from a separate device.

## Interruptions and lifecycle

Handle all of these — each has produced a crash or a stuck-silent state in similar apps:

- **Phone call / alarm** — session interrupted, then restored. On restore, re-activate the
  session; a running metronome should stop rather than resume half a bar in.
- **Headphones plugged in/out** — route change. Playback often auto-pauses on unplug (iOS
  convention). Reflect it in the UI rather than showing "playing" silently.
- **App backgrounded** — the metronome may keep running (`iosBackgroundMode: true` plus the
  Android foreground service).
- **Screen lock** — hold `expo-keep-awake` while running, release it when stopped.

## Verification checklist (device only)

1. Start the metronome → audio comes out of the **speaker**, not the earpiece.
2. Incoming call mid-bar → no crash, sensible state after.
3. Unplug headphones mid-metronome → no crash, UI state matches reality.
4. Background the app while running → keeps time.
5. Android: confirm the manifest contains only the permissions you declared.
