export type ProgressPhase = 'idle' | 'active' | 'finishing';

export interface ProgressSnapshot {
  phase: ProgressPhase;
  /** Progress value in the range [0, 1]. */
  value: number;
}

export interface ProgressOptions {
  /** Initial progress value shown right after a navigation starts. */
  minimum: number;
  /** Upper bound for trickling; the bar never reaches 1 until the navigation commits. */
  maximum: number;
  /** Interval (ms) between automatic trickle increments. */
  trickleSpeed: number;
  /** Duration (ms) of the CSS transitions (width growth and fade-out). */
  speed: number;
  /**
   * Safety net: if no navigation commit is observed within this time (ms),
   * the bar finishes anyway so it can never get stuck on a false start
   * (e.g. a click whose navigation was canceled by user code).
   */
  stallTimeoutMs: number;
  /**
   * Replacement safety budget (ms) armed once a real in-flight navigation is
   * observed. Longer than stallTimeoutMs so slow navigations are not cut off,
   * but still bounded: a hung RSC fetch produces no settlement signal, and the
   * bar must never be able to linger forever.
   */
  inFlightTimeoutMs: number;
}

export const defaultProgressOptions: ProgressOptions = {
  minimum: 0.08,
  maximum: 0.994,
  trickleSpeed: 200,
  speed: 200,
  stallTimeoutMs: 10_000,
  inFlightTimeoutMs: 30_000,
};

const idleSnapshot: ProgressSnapshot = { phase: 'idle', value: 0 };

let options: ProgressOptions = { ...defaultProgressOptions };
let snapshot: ProgressSnapshot = idleSnapshot;
const listeners = new Set<() => void>();
let trickleTimer: ReturnType<typeof setInterval> | undefined;
let stallTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let inFlightNavigation = false;

/** Start (or keep) the progress bar and begin trickling toward `maximum`. No-op on the server. */
export function startProgress(): void {
  // Client components also render on the server, where the bar always renders idle
  // (`getServerProgressSnapshot`). Starting there could not show anything and would leak the
  // trickle interval into the server process or edge isolate, so it is refused outright.
  if (globalThis.window === undefined) return;
  if (snapshot.phase === 'active') {
    // A new navigation superseded the current one; give it a fresh safety
    // budget of the current kind (the longer in-flight budget once a real
    // navigation was observed, so a second start cannot cut it off early).
    restartStallTimer();
    return;
  }
  clearTimers();
  update('active', options.minimum);
  trickleTimer = setInterval(() => {
    setProgress(snapshot.value + (options.maximum - snapshot.value) * 0.1);
  }, options.trickleSpeed);
  restartStallTimer();
}

/** Set the progress value explicitly, clamped to `[minimum, maximum]` (only while active). */
export function setProgress(value: number): void {
  if (snapshot.phase !== 'active') return;
  update('active', Math.min(options.maximum, Math.max(options.minimum, value)));
}

/** Complete the bar: grow to 100%, fade out, then unmount. No-op when idle. */
export function finishProgress(): void {
  if (snapshot.phase !== 'active') return;
  clearTimers();
  update('finishing', 1);
  idleTimer = setTimeout(() => {
    update('idle', 0);
  }, options.speed * 2);
}

/**
 * Switch the safety timer to the longer in-flight budget. Called when a real
 * in-flight navigation is observed (vinext set a pending pathname): the
 * settlement watcher and commit watcher finish the bar on commit or abort, so
 * a slow navigation must not be cut off by the short stall budget — but a
 * hung fetch never settles, so some bound must remain armed.
 */
export function markNavigationInFlight(): void {
  if (snapshot.phase !== 'active') return;
  inFlightNavigation = true;
  restartStallTimer();
}

/** Immediately remove the bar without the completion animation. */
export function resetProgress(): void {
  clearTimers();
  update('idle', 0);
}

export function configureProgress(partial: Partial<ProgressOptions>): void {
  // Ignore undefined entries so omitted props keep their current values.
  for (const [key, value] of Object.entries(partial)) {
    if (value !== undefined) options = { ...options, [key]: value };
  }
}

export function subscribeProgress(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProgressSnapshot(): ProgressSnapshot {
  return snapshot;
}

/** Server-side rendering always sees the idle state. */
export function getServerProgressSnapshot(): ProgressSnapshot {
  return idleSnapshot;
}

function restartStallTimer(): void {
  clearTimeout(stallTimer);
  stallTimer = setTimeout(
    () => {
      finishProgress();
    },
    inFlightNavigation ? options.inFlightTimeoutMs : options.stallTimeoutMs
  );
}

function update(phase: ProgressPhase, value: number): void {
  if (snapshot.phase === phase && snapshot.value === value) return;
  snapshot = { phase, value };
  // Iterating the Set directly is safe: mutation during iteration is well-defined (entries deleted
  // meanwhile are skipped), and a copy would allocate on every trickle tick. Re-entrant updates are
  // not a concern either: `subscribeProgress` is not part of the public API, so listeners are only
  // React's `useSyncExternalStore` callbacks, which schedule a re-render (reading the latest
  // snapshot) instead of synchronously mutating the store.
  for (const listener of listeners) listener();
}

function clearTimers(): void {
  clearInterval(trickleTimer);
  clearTimeout(stallTimer);
  clearTimeout(idleTimer);
  trickleTimer = stallTimer = idleTimer = undefined;
  inFlightNavigation = false;
}
