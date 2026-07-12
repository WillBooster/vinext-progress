import { afterAll, beforeEach, expect, test } from 'bun:test';

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

const browserGlobals = globalThis as { window?: unknown; location?: unknown };
const originalWindow = browserGlobals.window;
const originalLocation = browserGlobals.location;

beforeEach(() => {
  browserGlobals.window = globalThis;
  // The bar only starts for a same-origin URL that differs from the current one.
  browserGlobals.location = { href: 'http://localhost/', origin: 'http://localhost', pathname: '/', search: '' };
  resetProgress();
  setRouterTracking(true);
});

// bun test runs all files in one process, so leaked global stubs would poison later test files.
afterAll(() => {
  browserGlobals.window = originalWindow;
  browserGlobals.location = originalLocation;
  resetProgress();
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

test('patches a router with inherited writable methods (class instance)', () => {
  class Router {
    push(href: string): string {
      return `pushed ${href}`;
    }
    replace(href: string): string {
      return `replaced ${href}`;
    }
  }
  const router = new Router();
  patch(router);

  expect(router.push('/next')).toBe('pushed /next');
  expect(getProgressSnapshot().phase).toBe('active');
});

// Strict-mode assignment throws over an inherited read-only method even when the instance itself
// is extensible, which `Object.isExtensible` alone misses.
test('skips a router that inherits a read-only method instead of throwing', () => {
  const proto = {};
  Object.defineProperty(proto, 'push', {
    value: (href: string) => `pushed ${href}`,
    writable: false,
    configurable: true,
  });
  const router = Object.create(proto) as RouterLike;
  router.replace = (href) => `replaced ${href}`;

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
