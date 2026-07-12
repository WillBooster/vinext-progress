'use client';

/* oxlint-disable jsx-a11y/prefer-tag-over-role -- <progress> cannot be styled as a fixed full-width top bar */
import * as NextNavigation from 'next/navigation';
import { Suspense, useEffect, useLayoutEffect, useSyncExternalStore } from 'react';

import {
  handleDocumentClick,
  handleDocumentSubmit,
  patchAppRouter,
  setRouterTracking,
  watchNavigationSettlement,
} from './navigationTriggers.js';
import {
  configureProgress,
  defaultProgressOptions,
  finishProgress,
  getProgressSnapshot,
  getServerProgressSnapshot,
  subscribeProgress,
} from './progressStore.js';
import type { ProgressOptions } from './progressStore.js';

const { usePathname, useSearchParams } = NextNavigation;

// Patch before hydration renders anything; see patchAppRouter's JSDoc.
if (globalThis.window !== undefined) {
  patchAppRouter(NextNavigation);
  watchNavigationSettlement();
}

export interface NavigationProgressProps extends Partial<ProgressOptions> {
  /** Bar color. Any CSS color, including custom properties (e.g. `var(--brand)`). */
  color?: string;
  /** Bar height in pixels. */
  height?: number;
  zIndex?: number;
  /** Accessible name announced for the progress bar. */
  ariaLabel?: string;
  /** Start the bar on same-origin link clicks (default: true). */
  trackLinkClicks?: boolean;
  /** Start the bar on same-origin GET form submissions, e.g. `next/form` (default: true). */
  trackFormSubmits?: boolean;
  /** Start the bar on `router.push` / `router.replace` (vinext only; default: true). */
  trackRouterCalls?: boolean;
}

/**
 * Drop this component once into the root layout. It starts the bar on link
 * clicks and router calls, and — unlike `history.pushState`-patching loaders,
 * which vinext's router deliberately bypasses — finishes it by observing the
 * URL commit through `usePathname` / `useSearchParams`.
 */
export const NavigationProgress: React.FC<NavigationProgressProps> = ({
  color = '#29d',
  height = 3,
  zIndex = 1600,
  ariaLabel = 'Page navigation',
  trackLinkClicks = true,
  trackFormSubmits = true,
  trackRouterCalls = true,
  ...progressOptions
}) => {
  // Idempotent retry (module evaluation may have run before vinext's browser
  // entry installed window.next.router in an unusual chunk-evaluation order);
  // rendering from the root layout still precedes every child's first render.
  // Omitted props fall back to the documented defaults so that removing a
  // prop at runtime restores the default instead of keeping the stale value.
  const fullOptions = { ...defaultProgressOptions, ...definedEntries(progressOptions) };
  if (globalThis.window !== undefined) {
    patchAppRouter(NextNavigation);
    watchNavigationSettlement();
    // Configured during render (not only in the layout effect below): child
    // effects run before parent effects, so a child's mount-time router.push
    // would otherwise start the bar with default options or a stale tracking
    // flag. These writes are idempotent and derived only from props, so a
    // render that React replays (StrictMode) leaves the same values behind.
    configureProgress(fullOptions);
    setRouterTracking(trackRouterCalls);
  }

  // Re-assert the configuration on every commit: React may discard a render
  // (Suspense, errors, superseded transitions) after the render-phase writes
  // above ran with props that never commit; the next commit always lands here
  // and restores the committed configuration.
  useIsomorphicLayoutEffect(() => {
    configureProgress(fullOptions);
    setRouterTracking(trackRouterCalls);
  });

  useEffect(() => {
    if (!trackLinkClicks) return;
    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [trackLinkClicks]);

  useEffect(() => {
    if (!trackFormSubmits) return;
    document.addEventListener('submit', handleDocumentSubmit);
    return () => {
      document.removeEventListener('submit', handleDocumentSubmit);
    };
  }, [trackFormSubmits]);

  return (
    <>
      <Suspense fallback={undefined}>
        <NavigationCommitWatcher />
      </Suspense>
      <ProgressBarView ariaLabel={ariaLabel} color={color} height={height} speed={fullOptions.speed} zIndex={zIndex} />
    </>
  );
};

/**
 * Finishes the bar when the router commits a new URL. vinext guarantees these
 * hooks update exactly once per committed navigation (including `redirect()`,
 * server actions, and back/forward), so this is the single reliable completion
 * signal that requires no monkey-patching.
 */
const NavigationCommitWatcher: React.FC = () => {
  const pathname = usePathname();
  const search = useSearchParams()?.toString() ?? '';
  useEffect(() => {
    // No-op while idle, so running on mount is harmless.
    finishProgress();
  }, [pathname, search]);
  // Rendering undefined is valid for the react >=18 peer range (the "nothing
  // was returned from render" invariant was removed in React 18).
  return;
};

interface ProgressBarViewProps {
  ariaLabel: string;
  color: string;
  height: number;
  speed: number;
  zIndex: number;
}

const ProgressBarView: React.FC<ProgressBarViewProps> = ({ ariaLabel, color, height, speed, zIndex }) => {
  const { phase, value } = useSyncExternalStore(subscribeProgress, getProgressSnapshot, getServerProgressSnapshot);
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false);
  if (phase === 'idle') return;
  const finishing = phase === 'finishing';
  return (
    <div
      aria-label={ariaLabel}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(value * 100)}
      role="progressbar"
      style={{
        height,
        left: 0,
        pointerEvents: 'none',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex,
      }}
    >
      <div
        style={{
          background: color,
          height: '100%',
          opacity: finishing ? 0 : 1,
          transition: reducedMotion ? 'none' : `width ${speed}ms ease, opacity ${speed}ms ease ${speed}ms`,
          width: `${value * 100}%`,
        }}
      />
    </div>
  );
};

// `useLayoutEffect` warns when executed during server rendering (React 18), and this client
// component still renders on the server; on the server the fallback never runs anyway.
const useIsomorphicLayoutEffect = globalThis.window === undefined ? useEffect : useLayoutEffect;

function definedEntries(partial: Partial<ProgressOptions>): Partial<ProgressOptions> {
  return Object.fromEntries(
    Object.entries(partial).filter(([, value]) => value !== undefined)
  ) as Partial<ProgressOptions>;
}

// `matchMedia` is checked separately from `window`: jsdom defines `window` but not `matchMedia`,
// so consumers unit-testing their pages under jsdom would otherwise crash on this import.
const reducedMotionQuery =
  typeof globalThis.matchMedia === 'function' ? globalThis.matchMedia('(prefers-reduced-motion: reduce)') : undefined;

function subscribeReducedMotion(listener: () => void): () => void {
  reducedMotionQuery?.addEventListener('change', listener);
  return () => {
    reducedMotionQuery?.removeEventListener('change', listener);
  };
}

function getReducedMotion(): boolean {
  return reducedMotionQuery?.matches ?? false;
}
