import { afterAll, beforeEach, expect, test } from 'bun:test';

import { setRouterReportedTracking, watchNavigationSettlement } from '../../src/navigationTriggers.js';
import { getProgressSnapshot, resetProgress, startProgress } from '../../src/progressStore.js';

interface NavigationStateLike {
  pendingPathname: string | null;
}

function installState(): NavigationStateLike {
  // A fresh state object per test so each watcher installation starts clean.
  // oxlint-disable-next-line unicorn/no-null -- mirrors vinext's internal state shape
  const state: NavigationStateLike = { pendingPathname: null };
  (globalThis as Record<symbol, unknown>)[Symbol.for('vinext.clientNavigationState')] = state;
  watchNavigationSettlement();
  return state;
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
}

const browserGlobals = globalThis as { window?: unknown };
const originalWindow = browserGlobals.window;

beforeEach(() => {
  browserGlobals.window = globalThis;
  resetProgress();
  setRouterReportedTracking(true);
});

// bun test runs all files in one process, so leaked global stubs would poison later test files.
afterAll(() => {
  browserGlobals.window = originalWindow;
  delete (globalThis as Record<symbol, unknown>)[Symbol.for('vinext.clientNavigationState')];
  resetProgress();
});

test('a router-reported in-flight navigation starts the bar and settlement finishes it', async () => {
  const state = installState();

  state.pendingPathname = '/next';
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('active');

  // oxlint-disable-next-line unicorn/no-null -- vinext writes null on settlement
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('finishing');
});

test('an idle null-over-null write neither starts nor finishes the bar', async () => {
  const state = installState();

  // oxlint-disable-next-line unicorn/no-null -- vinext writes null over null on idle commits
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('idle');
});

test('router-reported tracking opt-out: bar is not started, but a started bar still settles', async () => {
  const state = installState();
  setRouterReportedTracking(false);

  state.pendingPathname = '/next';
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('idle');

  // A manually (or listener-) started bar must still be finished on settlement.
  startProgress();
  // oxlint-disable-next-line unicorn/no-null -- vinext writes null on settlement
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('finishing');
});

test('a manual start taking over an in-flight navigation survives its settlement', async () => {
  const state = installState();

  state.pendingPathname = '/next';
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('active');

  // The app claims the bar mid-flight; the navigation's settlement must no
  // longer finish it — only the app's own finish()/reset() may.
  startProgress(false);
  // oxlint-disable-next-line unicorn/no-null -- vinext writes null on settlement
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('active');
});

test('a navigation that settles before the microtask flushes never shows the bar', async () => {
  const state = installState();

  state.pendingPathname = '/next';
  // oxlint-disable-next-line unicorn/no-null -- settle synchronously, before the deferred start runs
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('idle');
});
