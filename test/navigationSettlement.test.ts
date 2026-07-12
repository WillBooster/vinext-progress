import { beforeEach, expect, test } from 'bun:test';

import { watchNavigationSettlement } from '../src/navigationTriggers.js';
import { getProgressSnapshot, resetProgress } from '../src/progressStore.js';

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

beforeEach(() => {
  (globalThis as { window?: unknown }).window = globalThis;
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

test('a navigation that settles before the microtask flushes never shows the bar', async () => {
  const state = installState();

  state.pendingPathname = '/next';
  // oxlint-disable-next-line unicorn/no-null -- settle synchronously, before the deferred start runs
  state.pendingPathname = null;
  await flushMicrotasks();
  expect(getProgressSnapshot().phase).toBe('idle');
});
