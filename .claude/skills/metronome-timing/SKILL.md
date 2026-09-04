---
name: metronome-timing
description: Drift-free metronome scheduling with the Web Audio clock — the lookahead scheduler pattern, why setInterval must never drive audio, beat/subdivision/accent math, meters, tap tempo, and Italian tempo terms with BPM ranges. Use when building or debugging the metronome engine, when clicks drift or stutter, or when mapping BPM to tempo markings.
---

# Metronome timing

The entire difficulty of a metronome is that JavaScript's clock and the audio clock are
different clocks, and only one of them is trustworthy.

## Never drive audio from setInterval

`setInterval(playClick, 60000 / bpm)` is the obvious implementation and it is wrong:

- The callback is *queued* after the delay, not *run* at it. Main-thread work — layout,
  React re-render, GC pause, a gesture handler — pushes it later.
- Typical error is 10–50 ms per tick on a phone. At 120 BPM that is up to 10 % of a beat.
- The errors **accumulate** if you re-arm relative to "now". Within a minute the
  metronome is audibly out of step with anything you are playing along to.
- Backgrounding or a busy JS thread makes it far worse.

## The lookahead scheduler (Chris Wilson pattern)

Two clocks, each doing what it is good at:

- **JS timer** — imprecise, but only used to *wake up and schedule*. It never plays anything.
- **`AudioContext.currentTime`** — a double-precision seconds counter driven by the audio
  hardware clock, sample-accurate. Every note is scheduled *ahead of time* against it.

```
LOOKAHEAD_MS   = 25    // how often the JS timer fires
SCHEDULE_AHEAD = 0.1   // seconds of future scheduled on each wake-up

scheduler():
    while nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD:
        scheduleClick(nextNoteTime, currentBeatInfo)
        advanceNote()
    // repeat via setInterval(scheduler, LOOKAHEAD_MS)

advanceNote():
    nextNoteTime += 60 / bpm / subdivisionsPerBeat   // += , never = now + ...
    step = (step + 1) % totalStepsInBar
```

Two invariants that carry the whole design:

1. **`nextNoteTime += interval`** — accumulate from the previous scheduled time. Never
   `nextNoteTime = ctx.currentTime + interval`; that re-injects the JS timer's jitter
   into the audio timeline every single beat, which is the drift you were avoiding.
2. **The JS timer never plays a sound.** It only calls `source.start(t)` with a future
   `t`. The audio thread does the playing, with sub-millisecond precision, regardless of
   what the JS thread is doing.

`SCHEDULE_AHEAD` (0.1 s) is the safety margin: how long the JS thread may stall before a
beat is missed. `LOOKAHEAD_MS` (25 ms) must be well under it. Raising `SCHEDULE_AHEAD`
buys robustness but delays how fast a BPM change takes effect — already-scheduled notes
cannot be un-scheduled cheaply. 0.1 s is the right trade-off; on a BPM change, let the
queued notes play out rather than tearing down the graph.

## Beat math

```
secondsPerBeat        = 60 / bpm
secondsPerStep        = secondsPerBeat / subdivisionsPerBeat
totalStepsInBar       = beatsPerBar * subdivisionsPerBeat
isDownbeat(step)      = step === 0
isBeat(step)          = step % subdivisionsPerBeat === 0
```

Subdivisions:

| Name | subdivisionsPerBeat |
|---|---|
| Quarter (beat only) | 1 |
| Eighths | 2 |
| Triplets | 3 |
| Sixteenths | 4 |

Compound meters (6/8, 9/8, 12/8): the dotted-quarter is the felt beat. Treat 6/8 as
2 beats × 3 subdivisions, not 6 beats — otherwise the accent lands in the wrong place
and the BPM number means something different from what a musician expects. Make this
explicit in the meter definition rather than deriving it from the numerator.

### Click sounds

Three distinct voices, so the bar structure is audible without looking:

| Step | Voice | Suggested |
|---|---|---|
| Downbeat (step 0) | accent | ~1500 Hz, gain 1.0 |
| Other beats | normal | ~1000 Hz, gain 0.7 |
| Off-beat subdivisions | subdivision | ~800 Hz, gain 0.35 |

Synthesize with `OscillatorNode` → `GainNode` with a short envelope (attack ~1 ms, decay
~40 ms). Create a fresh oscillator per click and `start(t)` / `stop(t + 0.05)` — nodes
are cheap and one-shot by design; do not try to reuse them.

Never use `gain.value = 0` to silence a click; use `setValueAtTime` / 
`exponentialRampToValueAtTime` scheduled against the same audio-clock time. And avoid
ramping to exactly 0 with the exponential ramp (it is undefined) — ramp to 0.0001.

### User-visible beat animation

The UI must *not* drive off the scheduler loop — those notes are up to 100 ms in the
future. Keep a small queue of `{ step, time }` and, in a `requestAnimationFrame` loop,
pop entries whose `time <= ctx.currentTime` to advance the visual beat indicator. This
keeps the dot in sync with what is actually being heard.

## Tap tempo

- Record timestamps of taps; drop the whole history if the gap exceeds ~2 s (user
  restarted).
- Use the **median** of the last 4 intervals, not the mean — one clumsy tap should not
  drag the tempo.
- Require at least 3 taps (2 intervals) before showing a result.
- Clamp the result to the supported BPM range and round to the nearest integer.

## BPM range

Support **20–300 BPM**. Below 20 the lookahead window logic still works but the UI
should show it as a very slow practice tempo; above 300 the clicks fuse perceptually.
Common practice range is 40–208 (the mechanical Maelzel metronome's range).

## Tempo terms

See `references/tempo-terms.md` for the full Italian marking → BPM table, and the note
on why the ranges overlap.

## Testing the scheduler without audio

Make the scheduler take the audio context as a **constructor argument**, not a module
import. Then in tests, pass a fake:

```ts
const fake = { currentTime: 0 };  // advance manually
```

Drive the scheduler loop by hand, collecting every scheduled `time`. Assertions worth
making at 120 BPM over 300 beats:

- consecutive deltas all equal `0.5 s` within 1e-9 (they are pure arithmetic — exact)
- `times[299] - times[0] === 299 * 0.5` — no cumulative drift
- advancing the fake clock in irregular jumps (simulating JS-thread stalls) changes
  *when* notes get scheduled, never *what time* they are scheduled for
- a 4/4 bar with sixteenths yields 16 steps, accent on step 0, `isBeat` true on 0/4/8/12

This test is the real proof of correctness — the device check only confirms it survives
contact with the platform.
