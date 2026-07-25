import { afterAll, beforeEach, describe, expect, test } from 'bun:test';

import {
  configureProgress,
  defaultProgressOptions,
  finishNavigationProgress,
  finishProgress,
  getProgressSnapshot,
  markNavigationInFlight,
  resetProgress,
  setProgress,
  startProgress,
  subscribeProgress,
} from '../../src/progressStore.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// The store refuses to start on the server, so these browser-behavior tests need a `window`.
beforeEach(() => {
  (globalThis as { window?: unknown }).window = globalThis;
  resetProgress();
  configureProgress({
    minimum: 0.08,
    maximum: 0.994,
    trickleSpeed: 10,
    speed: 10,
    stallTimeoutMs: 10_000,
    inFlightTimeoutMs: 30_000,
  });
});

// bun test runs all files in one process; leaked non-default options would make later files flaky.
afterAll(() => {
  configureProgress(defaultProgressOptions);
  resetProgress();
});

describe('startProgress', () => {
  test('activates the bar at the minimum value', () => {
    startProgress();
    expect(getProgressSnapshot()).toEqual({ phase: 'active', value: 0.08 });
  });

  test('trickles toward the maximum without reaching it', async () => {
    startProgress();
    const initial = getProgressSnapshot().value;
    await sleep(50);
    const trickled = getProgressSnapshot().value;
    expect(trickled).toBeGreaterThan(initial);
    expect(trickled).toBeLessThan(0.994 + Number.EPSILON);
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('is idempotent while active', () => {
    startProgress();
    setProgress(0.5);
    startProgress();
    expect(getProgressSnapshot().value).toBe(0.5);
  });
});

describe('finishProgress', () => {
  test('completes to 1, then returns to idle', async () => {
    startProgress();
    finishProgress();
    expect(getProgressSnapshot()).toEqual({ phase: 'finishing', value: 1 });
    await sleep(40);
    expect(getProgressSnapshot()).toEqual({ phase: 'idle', value: 0 });
  });

  test('is a no-op while idle', () => {
    finishProgress();
    expect(getProgressSnapshot()).toEqual({ phase: 'idle', value: 0 });
  });
});

describe('stall safety net', () => {
  test('auto-finishes when no commit arrives within stallTimeoutMs', async () => {
    configureProgress({ stallTimeoutMs: 20 });
    startProgress();
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('idle');
  });
});

describe('manual start', () => {
  test('outlives stallTimeoutMs: no safety timeout is armed', async () => {
    configureProgress({ stallTimeoutMs: 20 });
    startProgress(false);
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('taking over an automatically started bar disarms its stall timeout', async () => {
    configureProgress({ stallTimeoutMs: 20 });
    startProgress();
    startProgress(false);
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('an automatic start after a manual takeover gets the short stall budget again', async () => {
    configureProgress({ stallTimeoutMs: 20, inFlightTimeoutMs: 5000 });
    startProgress();
    markNavigationInFlight();
    startProgress(false);
    finishNavigationProgress();
    // A later false start (e.g. a canceled click) must not inherit the taken-over
    // navigation's 5000ms in-flight budget.
    startProgress();
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('idle');
  });
});

describe('finishNavigationProgress', () => {
  test('finishes a navigation-owned bar', () => {
    startProgress();
    finishNavigationProgress();
    expect(getProgressSnapshot().phase).toBe('finishing');
  });

  test('leaves a manually started bar running (app-level URL rewrites are not navigations)', () => {
    startProgress(false);
    finishNavigationProgress();
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('finishes a manual bar once a navigation takes it over', () => {
    startProgress(false);
    markNavigationInFlight();
    finishNavigationProgress();
    expect(getProgressSnapshot().phase).toBe('finishing');
  });
});

describe('markNavigationInFlight', () => {
  test('keeps the bar active past stallTimeoutMs while a navigation is in flight', async () => {
    configureProgress({ stallTimeoutMs: 20, inFlightTimeoutMs: 30_000 });
    startProgress();
    markNavigationInFlight();
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('a re-entrant start keeps the longer in-flight budget', async () => {
    configureProgress({ stallTimeoutMs: 20, inFlightTimeoutMs: 30_000 });
    startProgress();
    markNavigationInFlight();
    startProgress();
    await sleep(60);
    expect(getProgressSnapshot().phase).toBe('active');
  });

  test('a hung navigation still finishes after inFlightTimeoutMs', async () => {
    configureProgress({ stallTimeoutMs: 20, inFlightTimeoutMs: 60 });
    startProgress();
    markNavigationInFlight();
    await sleep(120);
    expect(getProgressSnapshot().phase).toBe('idle');
  });
});

describe('subscribeProgress', () => {
  test('notifies on changes and stops after unsubscribe', () => {
    let notifications = 0;
    const unsubscribe = subscribeProgress(() => {
      notifications++;
    });
    startProgress();
    expect(notifications).toBe(1);
    unsubscribe();
    finishProgress();
    expect(notifications).toBe(1);
    resetProgress();
  });

  // Client components render on the server too, where the bar is always idle. Starting there would
  // leak the trickle interval into the server process or edge isolate.
  test('stays idle and starts no trickle timer on the server', async () => {
    const globalWithWindow = globalThis as { window?: unknown };
    delete globalWithWindow.window;

    startProgress();
    expect(getProgressSnapshot()).toEqual({ phase: 'idle', value: 0 });

    // A leaked trickle interval (10ms here) would have advanced the value by now.
    await sleep(40);
    expect(getProgressSnapshot()).toEqual({ phase: 'idle', value: 0 });
  });
});
