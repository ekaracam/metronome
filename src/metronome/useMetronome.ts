import { useCallback, useEffect, useRef, useState } from 'react';

import { audioEngine } from '../audio/engine';
import { scheduleClick } from './clickSynth';
import { LOOKAHEAD_MS, MetronomeScheduler, type BarConfig, type ScheduledStep } from './scheduler';

/**
 * Drives the scheduler from a JS timer and keeps the beat indicator honest.
 *
 * The visual beat must not follow the scheduling loop — those clicks are up to 100 ms in
 * the future. A queue drained against the audio clock keeps the dot in step with what is
 * actually being heard.
 */

export type MetronomeState = {
  readonly running: boolean;
  /** Step index currently sounding, or -1 when stopped. */
  readonly currentStep: number;
};

export const useMetronome = (config: BarConfig) => {
  const schedulerRef = useRef<MetronomeScheduler | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const pendingRef = useRef<ScheduledStep[]>([]);

  const [running, setRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);

  // Keep the running scheduler in step with prop changes without restarting it.
  useEffect(() => {
    schedulerRef.current?.setConfig(config);
  }, [config]);

  const drainVisualQueue = useCallback(() => {
    const context = audioEngine.getContext();
    const now = context.currentTime;

    let latest: ScheduledStep | null = null;
    while (pendingRef.current.length > 0 && (pendingRef.current[0]?.time ?? 0) <= now) {
      latest = pendingRef.current.shift() ?? null;
    }
    if (latest) setCurrentStep(latest.step);

    frameRef.current = requestAnimationFrame(drainVisualQueue);
  }, []);

  const stop = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    pendingRef.current = [];
    schedulerRef.current?.stop();
    setRunning(false);
    setCurrentStep(-1);
  }, []);

  const start = useCallback(async () => {
    await audioEngine.setMode('playback');
    const context = audioEngine.getContext();

    if (!schedulerRef.current) {
      schedulerRef.current = new MetronomeScheduler(context, config);
    } else {
      schedulerRef.current.setConfig(config);
    }
    const scheduler = schedulerRef.current;
    scheduler.start();

    timerRef.current = setInterval(() => {
      for (const step of scheduler.pump()) {
        scheduleClick(context, step.time, step.kind);
        pendingRef.current.push(step);
      }
    }, LOOKAHEAD_MS);

    frameRef.current = requestAnimationFrame(drainVisualQueue);
    setRunning(true);
  }, [config, drainVisualQueue]);

  const toggle = useCallback(() => {
    if (running) {
      stop();
    } else {
      void start();
    }
  }, [running, start, stop]);

  useEffect(() => stop, [stop]);

  // A phone call mid-bar should stop the metronome outright: resuming half a bar in
  // would put the player out of step with no way to notice.
  useEffect(() => {
    return audioEngine.observeInterruptions((event) => {
      if (event.type === 'began') stop();
    });
  }, [stop]);

  return { running, currentStep, start, stop, toggle } as const;
};
