import { finishProgress, markNavigationInFlight, startProgress } from './progressStore.js';

/**
 * Start the bar when a same-origin, different-URL link is clicked.
 * This mirrors what the router itself will accept as a client-side navigation,
 * so external links, downloads, `target=_blank`, modified clicks, and
 * hash-only / same-URL clicks never trigger the bar.
 */
export function handleDocumentClick(event: MouseEvent): void {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : undefined;
  const anchor = target?.closest('a');
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (anchor.hasAttribute('download')) return;
  // Case-sensitive on purpose: vinext's own `<Link>` skips client-side navigation unless
  // `target === '_self'` exactly, so `target="_SELF"` becomes a full page load. Accepting it here
  // would show the bar for a navigation the router never performs.
  if (anchor.target && anchor.target !== '_self') return;
  const rawHref = anchor.getAttribute('href');
  if (!rawHref || rawHref.startsWith('#')) return;
  maybeStartForHref(anchor.href);
}

/**
 * Start the bar for GET form navigations (notably vinext's `next/form`, which
 * calls `navigateClientSide` directly and so bypasses both the click listener
 * and the router patch). Server-action forms are skipped: they have no string
 * `action` attribute. The destination is predicted the same way vinext's
 * `createFormSubmitDestinationUrl` builds it — drop the action URL's own
 * search, then append the submitted fields — so in-page search forms
 * (action = current pathname) start the bar too, while true no-op submits
 * still hit the same-URL skip.
 */
export function handleDocumentSubmit(event: SubmitEvent): void {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const submitter = event.submitter;
  const target = submitter?.getAttribute('formtarget') ?? form.getAttribute('target');
  // Case-sensitive for the same reason as the anchor target above: vinext's `<Form>` disables its
  // own navigation for any target other than exactly `_self`.
  if (target && target !== '_self') return;
  const method = (submitter?.getAttribute('formmethod') ?? form.getAttribute('method') ?? 'get').toLowerCase();
  if (method !== 'get') return;
  const action = submitter?.getAttribute('formaction') ?? form.getAttribute('action');
  // An empty string is a valid action (vinext resolves it against the current
  // URL); only a missing attribute means "not a URL-navigating form".
  if (action === null) return;
  let url: URL;
  try {
    url = new URL(action, globalThis.location.href);
  } catch {
    return;
  }
  url.search = '';
  const formData = new FormData(form, submitter ?? undefined);
  for (const [key, value] of formData.entries()) {
    // File entries contribute their file name, mirroring vinext's behavior.
    url.searchParams.append(key, typeof value === 'string' ? value : (value as unknown as File).name);
  }
  maybeStartForHref(url.href);
}

interface AppRouterLike {
  push: (...args: unknown[]) => unknown;
  replace: (...args: unknown[]) => unknown;
}

const patchedRouters = new WeakSet<object>();
let routerTrackingEnabled = true;

export function setRouterTracking(enabled: boolean): void {
  routerTrackingEnabled = enabled;
}

/**
 * Wrap `router.push` / `router.replace` on vinext's public App Router
 * singleton so programmatic navigations also start the bar. vinext exposes
 * `appRouterInstance` from its `next/navigation` shim; on plain Next.js the
 * export is absent and this becomes a no-op (link clicks still work).
 *
 * Must run at module-evaluation time (before hydration): vinext's
 * `useRouter()` spread-copies the singleton's methods during render and
 * memoizes the copy, so a patch installed in an effect would never be seen by
 * components that rendered first.
 */
export function patchAppRouter(navigationModule: unknown): void {
  patchRouterObject((navigationModule as { appRouterInstance?: AppRouterLike }).appRouterInstance);
  // Vite may create a second copy of the navigation shim (pre-bundled for app
  // code vs. raw for this library), so also patch the live singleton that
  // vinext's browser entry installs on `window.next.router` before hydration.
  patchRouterObject((globalThis as { next?: { router?: AppRouterLike } }).next?.router);
}

function patchRouterObject(router: AppRouterLike | undefined): void {
  if (!router || typeof router.push !== 'function' || typeof router.replace !== 'function') return;
  if (patchedRouters.has(router)) return;
  patchedRouters.add(router);
  for (const method of ['push', 'replace'] as const) {
    const original = router[method].bind(router);
    // Forward all arguments and the return value so the wrapper preserves the
    // full contract even when window.next.router is a Pages Router instance
    // (push(url, as, options) returning Promise<boolean>).
    router[method] = (...args) => {
      const [href] = args;
      if (routerTrackingEnabled && typeof href === 'string') maybeStartForHref(href);
      return original(...args);
    };
  }
}

interface ClientNavigationStateLike {
  pendingPathname?: string | null;
}

/**
 * Finish the bar whenever a navigation settles, even when the committed URL
 * equals the starting URL (e.g. a server-side `redirect()` back to the current
 * page) — in that case `usePathname`/`useSearchParams` never change, so the
 * commit watcher alone would leave the bar running until the stall timeout.
 *
 * vinext stores its navigation state on a window-global object (shared across
 * duplicated module copies) and resets `pendingPathname` to null when a
 * navigation commits or aborts, so an accessor on that property observes every
 * settlement. If vinext ever removes this internal, the accessor is simply
 * never installed and the public commit watcher + stall timeout still apply.
 */
export function watchNavigationSettlement(): void {
  const state = (globalThis as Record<symbol, unknown>)[Symbol.for('vinext.clientNavigationState')] as
    | ClientNavigationStateLike
    | undefined;
  if (!state || !('pendingPathname' in state)) return;
  const descriptor = Object.getOwnPropertyDescriptor(state, 'pendingPathname');
  // `writable` also excludes an accessor (already installed); `configurable` keeps a future vinext that
  // seals this property from turning `defineProperty` into a TypeError that would crash the host app,
  // since not installing the accessor degrades gracefully as described above.
  if (!descriptor?.writable || !descriptor.configurable) return;
  // oxlint-disable-next-line unicorn/no-null -- vinext's internal state uses null for "no pending navigation"
  let pendingPathname = state.pendingPathname ?? null;
  Object.defineProperty(state, 'pendingPathname', {
    configurable: true,
    enumerable: true,
    get: () => pendingPathname,
    set: (value: string | null) => {
      const previous = pendingPathname;
      pendingPathname = value;
      // Only a non-null → null transition is a settlement: vinext also writes
      // null over null on idle commits (external history.pushState/replaceState,
      // hash-only commits), which must not finish a manually started bar or one
      // started in the gap before setPendingPathname runs.
      // Deferred so the store update never runs inside React's render/commit,
      // where vinext may assign this property. Re-checked at flush time so a
      // navigation that starts before the microtask runs is not finished early.
      if (value === null && previous !== null) {
        queueMicrotask(() => {
          if (pendingPathname === null) finishProgress();
        });
      } else if (value !== null) {
        // A real navigation is in flight; settlement (or the commit watcher)
        // finishes the bar, so switch from the short stall budget to the
        // longer in-flight budget — merely slow navigations are not cut off,
        // but a hung fetch (which never settles) still cannot stick forever.
        markNavigationInFlight();
      }
    },
  });
}

function maybeStartForHref(href: string): void {
  let url: URL;
  try {
    url = new URL(href, globalThis.location.href);
  } catch {
    return;
  }
  if (url.origin !== globalThis.location.origin || !url.protocol.startsWith('http')) return;
  // Same pathname + search means either a hash-only change or a no-op
  // navigation; neither produces a URL commit, so starting would stall.
  if (url.pathname === globalThis.location.pathname && url.search === globalThis.location.search) return;
  startProgress();
}
