'use client';

import { finishProgress, getProgressSnapshot, resetProgress, setProgress, startProgress } from './progressStore.js';

export interface NavigationProgressController {
  start: () => void;
  /** Set the progress value explicitly (0–1). */
  set: (value: number) => void;
  finish: () => void;
  /** Remove the bar immediately without the completion animation. */
  reset: () => void;
  isActive: () => boolean;
}

const controller: NavigationProgressController = {
  start: startProgress,
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
