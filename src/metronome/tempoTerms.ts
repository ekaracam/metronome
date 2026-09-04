/**
 * BPM to Italian tempo marking.
 *
 * The published ranges overlap — Allegro and Vivace share most of their territory —
 * because the terms describe character as much as speed. This is therefore a lossy,
 * one-way, deliberately non-overlapping partition chosen for a single display label.
 * There is no term-to-BPM inverse, and there should not be one.
 */

type TempoTerm = {
  readonly minBpm: number;
  readonly label: string;
};

const TEMPO_TERMS: readonly TempoTerm[] = [
  { minBpm: 0, label: 'Grave' },
  { minBpm: 40, label: 'Largo' },
  { minBpm: 60, label: 'Larghetto' },
  { minBpm: 66, label: 'Adagio' },
  { minBpm: 76, label: 'Andante' },
  { minBpm: 108, label: 'Moderato' },
  { minBpm: 120, label: 'Allegro' },
  { minBpm: 140, label: 'Vivace' },
  { minBpm: 168, label: 'Presto' },
  { minBpm: 200, label: 'Prestissimo' },
];

export const tempoTerm = (bpm: number): string => {
  let label = TEMPO_TERMS[0]?.label ?? 'Grave';
  for (const term of TEMPO_TERMS) {
    if (bpm >= term.minBpm) label = term.label;
  }
  return label;
};
