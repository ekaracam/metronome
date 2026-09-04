import { classifyStep, secondsPerStep, stepsPerBar, type StepKind } from './patterns';

/**
 * Lookahead scheduler (the "two clocks" pattern).
 *
 * The JS timer is imprecise, so it never plays anything — it only wakes up and schedules
 * notes against the audio clock, which is sample-accurate. Everything here is pure
 * arithmetic over an injected clock, which is what makes the drift guarantee testable
 * without any audio hardware.
 */

/** Anything exposing an audio clock; AudioContext satisfies it. */
export type SchedulerClock = {
  readonly currentTime: number;
};

export type BarConfig = {
  readonly bpm: number;
  readonly beatsPerBar: number;
  readonly subdivisionsPerBeat: number;
  /** Beat indices accented on top of the always-accented downbeat. */
  readonly accents: readonly number[];
};

export type ScheduledStep = {
  /** Audio-clock time this step should sound at. */
  readonly time: number;
  /** Index within the bar, 0-based, counting subdivisions. */
  readonly step: number;
  /** Beat this step belongs to, 0-based. */
  readonly beat: number;
  readonly kind: StepKind;
};

/** How far ahead of the audio clock notes are queued. */
export const SCHEDULE_AHEAD_SECONDS = 0.1;
/** How often the driver should call pump(). Must be well under the horizon above. */
export const LOOKAHEAD_MS = 25;
/** Small offset so the first click is not scheduled in the past. */
const START_DELAY_SECONDS = 0.06;

export class MetronomeScheduler {
  private config: BarConfig;
  private nextNoteTime = 0;
  private step = 0;
  private running = false;

  constructor(
    private readonly clock: SchedulerClock,
    config: BarConfig,
  ) {
    this.config = config;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.step = 0;
    this.nextNoteTime = this.clock.currentTime + START_DELAY_SECONDS;
  }

  stop(): void {
    this.running = false;
    this.step = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Applies a new configuration. Already-queued notes play out at the old tempo — the
   * horizon is only 100 ms, and tearing down scheduled nodes to shave that off costs
   * more than it gains.
   */
  setConfig(config: BarConfig): void {
    const barChanged =
      config.beatsPerBar !== this.config.beatsPerBar ||
      config.subdivisionsPerBeat !== this.config.subdivisionsPerBeat;
    this.config = config;
    if (barChanged) this.step = 0;
  }

  getConfig(): BarConfig {
    return this.config;
  }

  /**
   * Schedules every step falling inside the lookahead horizon and returns them, so the
   * caller can both synthesize the clicks and queue the matching UI animation.
   */
  pump(): ScheduledStep[] {
    if (!this.running) return [];

    const scheduled: ScheduledStep[] = [];
    const horizon = this.clock.currentTime + SCHEDULE_AHEAD_SECONDS;

    while (this.nextNoteTime < horizon) {
      const { subdivisionsPerBeat, accents, bpm, beatsPerBar } = this.config;
      scheduled.push({
        time: this.nextNoteTime,
        step: this.step,
        beat: Math.floor(this.step / subdivisionsPerBeat),
        kind: classifyStep(this.step, subdivisionsPerBeat, accents),
      });

      // Accumulate from the previous scheduled time. Using `clock.currentTime + interval`
      // here would re-inject the JS timer's jitter into the audio timeline on every beat,
      // which is exactly the drift this design exists to avoid.
      this.nextNoteTime += secondsPerStep(bpm, subdivisionsPerBeat);
      this.step = (this.step + 1) % stepsPerBar(beatsPerBar, subdivisionsPerBeat);
    }

    return scheduled;
  }
}
