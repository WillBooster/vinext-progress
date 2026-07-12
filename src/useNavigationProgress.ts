'use client';

import { finishProgress, getProgressSnapshot, resetProgress, setProgress, startProgress } from './progressStore.js';

export interface NavigationProgressController {
  /**
   * Start the bar. Unlike automatic (navigation-driven) starts, no safety
   * timeout is armed: the bar trickles until `finish()` or `reset()` is
   * called, so long-running work is never cut off mid-flight.
   */
  start: () => void;
  /**
   * Set the progress value explicitly. Clamped to `[minimum, maximum]`
   * (defaults: 0.08–0.994) — the bar never shows 0% or 100% while active;
   * call `finish()` to complete it.
   */
  set: (value: number) => void;
  finish: () => void;
  /** Remove the bar immediately without the completion animation. */
  reset: () => void;
  /**
   * Point-in-time read of whether the bar is active. Not reactive: calling it
   * during render does not subscribe the component, so a phase change alone
   * never triggers a re-render.
   */
  isActive: () => boolean;
}

const controller: NavigationProgressController = {
  start: () => {
    startProgress(false);
  },
  set: setProgress,
  finish: finishProgress,
  reset: resetProgress,
  isActive: () => getProgressSnapshot().phase === 'active',
};

/**
 * Manual control over the shared progress bar, e.g. to show it during a
 * long-running server action that does not navigate.
 */
export function useNavigationProgress(): NavigationProgressController {
  return controller;
}
