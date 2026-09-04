import {
  METERS,
  SUBDIVISIONS,
  bpmFromTaps,
  classifyStep,
  clampBpm,
  getMeter,
  getSubdivision,
  secondsPerStep,
  stepsPerBar,
} from './patterns';
import { tempoTerm } from './tempoTerms';

describe('meters and subdivisions', () => {
  it('has unique ids', () => {
    expect(new Set(METERS.map((m) => m.id)).size).toBe(METERS.length);
    expect(new Set(SUBDIVISIONS.map((s) => s.id)).size).toBe(SUBDIVISIONS.length);
  });

  it('counts compound meters in felt beats', () => {
    expect(getMeter('6/8').beatsPerBar).toBe(2);
    expect(getMeter('6/8').defaultSubdivisionId).toBe('triplet');
    expect(getMeter('9/8').beatsPerBar).toBe(3);
    expect(getMeter('12/8').beatsPerBar).toBe(4);
  });

  it('falls back to 4/4 and the beat subdivision for unknown ids', () => {
    expect(getMeter('nope').id).toBe('4/4');
    expect(getSubdivision('nope').perBeat).toBe(1);
  });

  it('maps every subdivision to its count per beat', () => {
    expect(SUBDIVISIONS.map((s) => s.perBeat)).toEqual([1, 2, 3, 4]);
  });
});

describe('bar arithmetic', () => {
  it('multiplies beats by subdivisions', () => {
    expect(stepsPerBar(4, 4)).toBe(16);
    expect(stepsPerBar(2, 3)).toBe(6);
  });

  it('divides the beat by the subdivision count', () => {
    expect(secondsPerStep(120, 1)).toBeCloseTo(0.5, 9);
    expect(secondsPerStep(120, 4)).toBeCloseTo(0.125, 9);
    expect(secondsPerStep(60, 3)).toBeCloseTo(1 / 3, 9);
  });
});

describe('classifyStep', () => {
  it('always treats step 0 as the downbeat, accent list or not', () => {
    expect(classifyStep(0, 1, [])).toBe('downbeat');
    expect(classifyStep(0, 4, [0, 2])).toBe('downbeat');
  });

  it('separates beats from their subdivisions', () => {
    expect(classifyStep(4, 4, [])).toBe('beat');
    expect(classifyStep(5, 4, [])).toBe('subdivision');
    expect(classifyStep(8, 4, [])).toBe('beat');
  });

  it('promotes accented beats', () => {
    expect(classifyStep(8, 4, [2])).toBe('accent');
    expect(classifyStep(9, 4, [2])).toBe('subdivision');
  });
});

describe('clampBpm', () => {
  it('constrains and rounds', () => {
    expect(clampBpm(120)).toBe(120);
    expect(clampBpm(5)).toBe(20);
    expect(clampBpm(999)).toBe(300);
    expect(clampBpm(119.6)).toBe(120);
  });
});

describe('bpmFromTaps', () => {
  it('needs at least three taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([0])).toBeNull();
    expect(bpmFromTaps([0, 500])).toBeNull();
  });

  it('reads an even 120 BPM tap', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500, 2000])).toBe(120);
  });

  it('ignores one clumsy tap thanks to the median', () => {
    // Four intervals: 500, 500, 620, 500 -> median 500 -> 120 BPM.
    expect(bpmFromTaps([0, 500, 1000, 1620, 2120])).toBe(120);
  });

  it('starts over after a long pause', () => {
    expect(bpmFromTaps([0, 500, 1000, 9000])).toBeNull();
  });

  it('clamps an implausibly fast tap', () => {
    expect(bpmFromTaps([0, 50, 100, 150])).toBe(300);
  });
});

describe('tempoTerm', () => {
  it('labels the common tempos', () => {
    expect(tempoTerm(50)).toBe('Largo');
    expect(tempoTerm(72)).toBe('Adagio');
    expect(tempoTerm(90)).toBe('Andante');
    expect(tempoTerm(112)).toBe('Moderato');
    expect(tempoTerm(132)).toBe('Allegro');
    expect(tempoTerm(180)).toBe('Presto');
  });

  it('is exact at the partition boundaries', () => {
    expect(tempoTerm(39)).toBe('Grave');
    expect(tempoTerm(40)).toBe('Largo');
    expect(tempoTerm(119)).toBe('Moderato');
    expect(tempoTerm(120)).toBe('Allegro');
    expect(tempoTerm(199)).toBe('Presto');
    expect(tempoTerm(200)).toBe('Prestissimo');
  });
});
