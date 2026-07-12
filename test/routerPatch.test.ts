import { beforeEach, expect, test } from 'bun:test';

import { patchAppRouter, setRouterTracking } from '../src/navigationTriggers.js';
import { getProgressSnapshot, resetProgress } from '../src/progressStore.js';

// The patch runs while the module is evaluated, so a throw here would crash the host app on import.
interface RouterLike {
  push: (href: string) => string;
  replace: (href: string) => string;
}

function patch(router: RouterLike): void {
  patchAppRouter({ appRouterInstance: router } as never);
}

beforeEach(() => {
  const browserGlobals = globalThis as { window?: unknown; location?: unknown };
  browserGlobals.window = globalThis;
  // The bar only starts for a same-origin URL that differs from the current one.
  browserGlobals.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '' };
  resetProgress();
  setRouterTracking(true);
});

test('patches a normal router, preserving its arguments and return value', () => {
  const router: RouterLike = { push: (href) => `pushed ${href}`, replace: (href) => `replaced ${href}` };
  patch(router);

  expect(router.push('/next')).toBe('pushed /next');
  expect(getProgressSnapshot().phase).toBe('active');
});

test('skips a frozen router instead of throwing', () => {
  const router: RouterLike = Object.freeze({
    push: (href: string) => `pushed ${href}`,
    replace: (href: string) => `replaced ${href}`,
  });

  expect(() => {
    patch(router);
  }).not.toThrow();
  expect(router.push('/next')).toBe('pushed /next');
});

// An extensible object can still carry a read-only method, which `Object.isExtensible` alone misses.
test('skips a router whose method is read-only instead of throwing', () => {
  const router = { replace: (href: string) => `replaced ${href}` } as RouterLike;
  Object.defineProperty(router, 'push', {
    value: (href: string) => `pushed ${href}`,
    writable: false,
    configurable: true,
  });

  expect(() => {
    patch(router);
  }).not.toThrow();
  expect(router.push('/next')).toBe('pushed /next');
});
