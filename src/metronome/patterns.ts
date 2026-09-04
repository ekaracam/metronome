/** Meters, subdivisions and the bar arithmetic shared by the scheduler and the UI. */

// Type-only, so this stays a pure data module at runtime and the tests never pull the
// dictionary in. It buys compile-time proof that every key here has a translation.
import type { StringKey } from '../i18n/i18n';

export type Meter = {
  readonly id: string;
  readonly label: string;
  /**
   * Felt beats per bar. Compound meters are counted the way musicians count them:
   * 6/8 is two beats of three, not six beats. Counting it as six would put the accent
   * in the wrong place and make the BPM number mean something other than what a
   * player expects.
   */
  readonly beatsPerBar: number;
  /** Subdivision the meter implies on its own — 3 for compound, 1 for simple. */
  readonly defaultSubdivisionId: string;
  readonly hintKey?: StringKey;
};

export type Subdivision = {
  readonly id: string;
  readonly labelKey: StringKey;
  readonly perBeat: number;
};

export const SUBDIVISIONS: readonly Subdivision[] = [
  { id: 'quarter', labelKey: 'subdivision.quarter', perBeat: 1 },
  { id: 'eighth', labelKey: 'subdivision.eighth', perBeat: 2 },
  { id: 'triplet', labelKey: 'subdivision.triplet', perBeat: 3 },
  { id: 'sixteenth', labelKey: 'subdivision.sixteenth', perBeat: 4 },
];

export const METERS: readonly Meter[] = [
  { id: '2/4', label: '2/4', beatsPerBar: 2, defaultSubdivisionId: 'quarter' },
  { id: '3/4', label: '3/4', beatsPerBar: 3, defaultSubdivisionId: 'quarter' },
  { id: '4/4', label: '4/4', beatsPerBar: 4, defaultSubdivisionId: 'quarter' },
  { id: '5/4', label: '5/4', beatsPerBar: 5, defaultSubdivisionId: 'quarter' },
  {
    id: '6/8',
    label: '6/8',
    beatsPerBar: 2,
    defaultSubdivisionId: 'triplet',
    hintKey: 'meter.hint.twoDotted',
  },
  {
    id: '7/8',
    label: '7/8',
    beatsPerBar: 7,
    defaultSubdivisionId: 'quarter',
    hintKey: 'meter.hint.eighthCount',
  },
  {
    id: '9/8',
    label: '9/8',
    beatsPerBar: 3,
    defaultSubdivisionId: 'triplet',
    hintKey: 'meter.hint.threeDotted',
  },
  {
    id: '12/8',
    label: '12/8',
    beatsPerBar: 4,
    defaultSubdivisionId: 'triplet',
    hintKey: 'meter.hint.fourDotted',
  },
];

export const DEFAULT_METER_ID = '4/4';
export const DEFAULT_SUBDIVISION_ID = 'quarter';

export const MIN_BPM = 20;
export const MAX_BPM = 300;

export const clampBpm = (bpm: number): number =>
  Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)));

export const getMeter = (id: string): Meter =>
  METERS.find((m) => m.id === id) ?? METERS.find((m) => m.id === DEFAULT_METER_ID) ?? {
    id: DEFAULT_METER_ID,
    label: DEFAULT_METER_ID,
    beatsPerBar: 4,
    defaultSubdivisionId: DEFAULT_SUBDIVISION_ID,
  };

export const getSubdivision = (id: string): Subdivision =>
  SUBDIVISIONS.find((s) => s.id === id) ??
  SUBDIVISIONS.find((s) => s.id === DEFAULT_SUBDIVISION_ID) ?? {
    id: DEFAULT_SUBDIVISION_ID,
    labelKey: 'subdivision.quarter',
    perBeat: 1,
  };

export type StepKind = 'downbeat' | 'accent' | 'beat' | 'subdivision';

export const stepsPerBar = (beatsPerBar: number, subdivisionsPerBeat: number): number =>
  beatsPerBar * subdivisionsPerBeat;

export const isBeat = (step: number, subdivisionsPerBeat: number): boolean =>
  step % subdivisionsPerBeat === 0;

export const beatOfStep = (step: number, subdivisionsPerBeat: number): number =>
  Math.floor(step / subdivisionsPerBeat);

export const classifyStep = (
  step: number,
  subdivisionsPerBeat: number,
  accents: readonly number[],
): StepKind => {
  if (step === 0) return 'downbeat';
  if (!isBeat(step, subdivisionsPerBeat)) return 'subdivision';
  return accents.includes(beatOfStep(step, subdivisionsPerBeat)) ? 'accent' : 'beat';
};

export const secondsPerBeat = (bpm: number): number => 60 / bpm;

export const secondsPerStep = (bpm: number, subdivisionsPerBeat: number): number =>
  secondsPerBeat(bpm) / subdivisionsPerBeat;

/**
 * Tap tempo from a series of timestamps in milliseconds.
 *
 * Uses the median of recent intervals rather than the mean so one clumsy tap does not
 * drag the tempo. Returns null until there are enough taps to be meaningful.
 */
export const TAP_TIMEOUT_MS = 2000;
const TAP_INTERVALS_USED = 4;

export const bpmFromTaps = (timestamps: readonly number[]): number | null => {
  if (timestamps.length < 3) return null;

  const intervals: number[] = [];
  for (let i = timestamps.length - 1; i > 0 && intervals.length < TAP_INTERVALS_USED; i -= 1) {
    const gap = (timestamps[i] ?? 0) - (timestamps[i - 1] ?? 0);
    if (gap <= 0 || gap > TAP_TIMEOUT_MS) break;
    intervals.push(gap);
  }
  if (intervals.length < 2) return null;

  const sorted = [...intervals].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianGap =
    sorted.length % 2 === 1
      ? (sorted[middle] ?? 0)
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;

  if (medianGap <= 0) return null;
  return clampBpm(60000 / medianGap);
};
