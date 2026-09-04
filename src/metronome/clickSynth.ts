import type { AudioContext } from 'react-native-audio-api';

import type { StepKind } from './patterns';

/**
 * Synthesized metronome clicks. Three distinct voices make the bar structure audible
 * without looking at the screen.
 */

type Voice = {
  readonly frequency: number;
  readonly gain: number;
};

const VOICES: Record<StepKind, Voice> = {
  downbeat: { frequency: 1500, gain: 1.0 },
  accent: { frequency: 1500, gain: 0.85 },
  beat: { frequency: 1000, gain: 0.7 },
  subdivision: { frequency: 800, gain: 0.35 },
};

const ATTACK_SECONDS = 0.001;
const DECAY_SECONDS = 0.04;
/** exponentialRampToValueAtTime is undefined at exactly zero. */
const SILENCE = 0.0001;

/**
 * Schedules one click at an audio-clock time. Nodes are one-shot by design and cheap,
 * so a fresh oscillator per click is correct — reusing them is not.
 */
export const scheduleClick = (
  context: AudioContext,
  time: number,
  kind: StepKind,
  volume = 1,
): void => {
  const voice = VOICES[kind];
  const oscillator = context.createOscillator();
  const envelope = context.createGain();

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(voice.frequency, time);

  // Every level change is scheduled against the same audio clock as the note itself;
  // touching gain.value directly would apply it whenever the JS thread got round to it.
  envelope.gain.setValueAtTime(SILENCE, time);
  envelope.gain.exponentialRampToValueAtTime(voice.gain * volume, time + ATTACK_SECONDS);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, time + DECAY_SECONDS);

  oscillator.connect(envelope);
  envelope.connect(context.destination);

  oscillator.start(time);
  oscillator.stop(time + DECAY_SECONDS + 0.01);
};
