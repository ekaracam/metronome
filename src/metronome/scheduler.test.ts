import {
  MetronomeScheduler,
  SCHEDULE_AHEAD_SECONDS,
  type BarConfig,
  type ScheduledStep,
} from './scheduler';

/** Manually advanced stand-in for AudioContext's clock. */
class FakeClock {
  currentTime = 0;
  advance(seconds: number): void {
    this.currentTime += seconds;
  }
}

const config = (patch: Partial<BarConfig> = {}): BarConfig => ({
  bpm: 120,
  beatsPerBar: 4,
  subdivisionsPerBeat: 1,
  accents: [],
  ...patch,
});

/** Runs the scheduler for a number of pumps, gathering everything it scheduled. */
const run = (
  scheduler: MetronomeScheduler,
  clock: FakeClock,
  pumps: number,
  stepSeconds = 0.025,
): ScheduledStep[] => {
  const collected: ScheduledStep[] = [];
  for (let i = 0; i < pumps; i += 1) {
    collected.push(...scheduler.pump());
    clock.advance(stepSeconds);
  }
  return collected;
};

describe('MetronomeScheduler timing', () => {
  it('schedules nothing until started', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config());
    expect(run(scheduler, clock, 10)).toHaveLength(0);
  });

  it('schedules the first click slightly in the future, never in the past', () => {
    const clock = new FakeClock();
    clock.advance(12.5);
    const scheduler = new MetronomeScheduler(clock, config());
    scheduler.start();
    const first = scheduler.pump()[0];
    expect(first?.time ?? 0).toBeGreaterThan(clock.currentTime);
  });

  it('spaces beats at exactly 60/bpm seconds', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ bpm: 120 }));
    scheduler.start();
    // 1000 pumps of 25 ms is 25 s of audio clock: 50 beats at 120 BPM.
    const steps = run(scheduler, clock, 1000);
    expect(steps.length).toBeGreaterThanOrEqual(49);
    for (let i = 1; i < steps.length; i += 1) {
      expect((steps[i]?.time ?? 0) - (steps[i - 1]?.time ?? 0)).toBeCloseTo(0.5, 9);
    }
  });

  it('does not accumulate drift over 300 beats', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ bpm: 120 }));
    scheduler.start();
    // 300 beats at 120 BPM is 150 s, which needs 6000 pumps of 25 ms.
    const steps = run(scheduler, clock, 6100);
    expect(steps.length).toBeGreaterThanOrEqual(300);

    const first = steps[0]?.time ?? 0;
    const last = steps[299]?.time ?? 0;
    expect(last - first).toBeCloseTo(299 * 0.5, 6);
  });

  it('keeps beat times unchanged when the JS thread stalls', () => {
    const smooth = new FakeClock();
    const smoothScheduler = new MetronomeScheduler(smooth, config());
    smoothScheduler.start();
    const smoothSteps = run(smoothScheduler, smooth, 2000);

    const stuttering = new FakeClock();
    const stutteringScheduler = new MetronomeScheduler(stuttering, config());
    stutteringScheduler.start();
    const stutteringSteps: ScheduledStep[] = [];
    // Irregular wake-ups, including stalls longer than the lookahead horizon.
    const gaps = [0.025, 0.09, 0.01, 0.2, 0.025, 0.35, 0.005];
    for (let i = 0; i < 400; i += 1) {
      stutteringSteps.push(...stutteringScheduler.pump());
      stuttering.advance(gaps[i % gaps.length] ?? 0.025);
    }

    const count = Math.min(smoothSteps.length, stutteringSteps.length);
    expect(count).toBeGreaterThan(50);
    for (let i = 0; i < count; i += 1) {
      expect(stutteringSteps[i]?.time ?? 0).toBeCloseTo(smoothSteps[i]?.time ?? 0, 9);
    }
  });

  it('never schedules further ahead than the horizon', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ bpm: 300 }));
    scheduler.start();
    for (let i = 0; i < 100; i += 1) {
      for (const step of scheduler.pump()) {
        expect(step.time).toBeLessThan(clock.currentTime + SCHEDULE_AHEAD_SECONDS + 1e-9);
      }
      clock.advance(0.025);
    }
  });

  it('honours the subdivision when spacing steps', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(
      clock,
      config({ bpm: 60, subdivisionsPerBeat: 4 }),
    );
    scheduler.start();
    const steps = run(scheduler, clock, 100);
    expect((steps[1]?.time ?? 0) - (steps[0]?.time ?? 0)).toBeCloseTo(0.25, 9);
  });
});

describe('MetronomeScheduler bar structure', () => {
  it('cycles the step index through the bar', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ beatsPerBar: 3 }));
    scheduler.start();
    const steps = run(scheduler, clock, 200).slice(0, 7);
    expect(steps.map((s) => s.step)).toEqual([0, 1, 2, 0, 1, 2, 0]);
  });

  it('produces 16 steps per bar of 4/4 sixteenths, with beats every 4', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(
      clock,
      config({ beatsPerBar: 4, subdivisionsPerBeat: 4 }),
    );
    scheduler.start();
    const bar = run(scheduler, clock, 400).slice(0, 16);
    expect(bar).toHaveLength(16);
    expect(bar[0]?.kind).toBe('downbeat');
    expect([4, 8, 12].map((i) => bar[i]?.kind)).toEqual(['beat', 'beat', 'beat']);
    expect([1, 2, 3, 5].map((i) => bar[i]?.kind)).toEqual([
      'subdivision',
      'subdivision',
      'subdivision',
      'subdivision',
    ]);
  });

  it('marks accented beats', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ beatsPerBar: 4, accents: [2] }));
    scheduler.start();
    const bar = run(scheduler, clock, 300).slice(0, 4);
    expect(bar.map((s) => s.kind)).toEqual(['downbeat', 'beat', 'accent', 'beat']);
  });

  it('counts 6/8 as two beats of three', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(
      clock,
      config({ beatsPerBar: 2, subdivisionsPerBeat: 3 }),
    );
    scheduler.start();
    const bar = run(scheduler, clock, 300).slice(0, 6);
    expect(bar.map((s) => s.kind)).toEqual([
      'downbeat',
      'subdivision',
      'subdivision',
      'beat',
      'subdivision',
      'subdivision',
    ]);
    expect(bar.map((s) => s.beat)).toEqual([0, 0, 0, 1, 1, 1]);
  });
});

describe('MetronomeScheduler configuration changes', () => {
  it('applies a new tempo to subsequent steps', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ bpm: 60 }));
    scheduler.start();
    run(scheduler, clock, 40);

    scheduler.setConfig(config({ bpm: 120 }));
    const after = run(scheduler, clock, 200);
    const tail = after.slice(-5);
    for (let i = 1; i < tail.length; i += 1) {
      expect((tail[i]?.time ?? 0) - (tail[i - 1]?.time ?? 0)).toBeCloseTo(0.5, 9);
    }
  });

  it('restarts the bar when the meter changes but not when only the tempo does', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config({ beatsPerBar: 4 }));
    scheduler.start();
    const before = run(scheduler, clock, 60); // partway through the bar
    const lastStep = before[before.length - 1]?.step ?? 0;

    // Tempo-only change keeps counting where the bar left off.
    scheduler.setConfig(config({ beatsPerBar: 4, bpm: 132 }));
    const sameMeter = run(scheduler, clock, 60);
    expect(sameMeter[0]?.step).toBe((lastStep + 1) % 4);

    // A meter change restarts the bar, so the next click is a downbeat.
    scheduler.setConfig(config({ beatsPerBar: 3 }));
    const newMeter = run(scheduler, clock, 60);
    expect(newMeter[0]?.step).toBe(0);
  });

  it('resumes from step 0 after a stop and start', () => {
    const clock = new FakeClock();
    const scheduler = new MetronomeScheduler(clock, config());
    scheduler.start();
    run(scheduler, clock, 60);
    scheduler.stop();
    expect(scheduler.isRunning()).toBe(false);
    expect(scheduler.pump()).toHaveLength(0);

    scheduler.start();
    expect(scheduler.pump()[0]?.step).toBe(0);
  });
});
