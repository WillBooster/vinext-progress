import { expect, mock, test } from 'bun:test';

// `next/navigation` is resolved by the consuming app (vinext aliases it to its own shim),
// so it cannot be imported for real outside one.
await mock.module('next/navigation', () => ({
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// jsdom defines `window` but not `matchMedia`, so consumers unit-testing their pages under jsdom
// import this module in exactly this shape. It must not throw while evaluating.
test('imports in a DOM environment that has no matchMedia', async () => {
  const globalWithWindow = globalThis as { window?: unknown };
  expect(globalThis.matchMedia).toBeUndefined();
  globalWithWindow.window = globalThis;

  try {
    const { NavigationProgress } = await import('../../src/NavigationProgress.js');
    expect(typeof NavigationProgress).toBe('function');
  } finally {
    delete globalWithWindow.window;
  }
});
