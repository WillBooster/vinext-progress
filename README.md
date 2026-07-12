# vinext-progress

[![Test](https://github.com/WillBooster/vinext-progress/actions/workflows/test.yml/badge.svg)](https://github.com/WillBooster/vinext-progress/actions/workflows/test.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)

Framework-native navigation progress bar for [vinext](https://github.com/cloudflare/vinext). Detects route transitions through the router itself — no history monkey-patching, no stuck bars, ~2 kB gzipped, accessible by default.

> This is an independent community package by [WillBooster Inc.](https://willbooster.com) and is not affiliated with or endorsed by Cloudflare or the vinext project.

## Why not nextjs-toploader / holy-loader?

Existing top loaders finish the bar by monkey-patching `window.history.pushState`. vinext's App Router deliberately bypasses external history patches (it commits URLs through a captured native `pushState` to avoid spurious re-renders), so those loaders start the bar but never finish it — the bar trickles forever.

vinext-progress takes the opposite approach:

- **Finish** — observes the URL commit through `usePathname()` / `useSearchParams()`, which vinext (and Next.js) guarantee to update exactly once per committed navigation. Covers `<Link>`, `router.push`/`replace`, `redirect()`, server actions, and back/forward. No patching.
- **Start** — a document-level click listener that mirrors the router's own link-acceptance rules (same-origin, not `target=_blank`, not `download`, not modified clicks, not hash-only or same-URL), a submit listener for GET form navigations (`next/form`), plus a wrapper around vinext's public `appRouterInstance` so programmatic `router.push`/`router.replace` also show the bar. On vinext, any navigation the router itself reports as in-flight also starts the bar — covering back/forward traversals that refetch, server-action redirects, and `router.refresh()`, independent of the `track*` props.
- **Never stuck** — a settlement watcher on vinext's window-global navigation state finishes the bar even when the committed URL equals the starting URL (e.g. `redirect()` back to the current page). A stall timeout clears starts that never become a navigation (e.g. a click canceled by user code), and once a real navigation is observed it is replaced by a longer in-flight timeout so slow navigations are not cut off but a hung fetch still cannot pin the bar forever.

Additional properties:

- ~2 kB gzipped (~5 kB minified), zero dependencies, no nprogress.
- No CSS injection at all (inline styles only) — no `<style>` tags or runtime stylesheets. Note: a strict nonce/hash-based CSP blocks inline style _attributes_, so the bar needs `style-src 'unsafe-inline'` (or `'unsafe-hashes'` with the style hashes) to be visible.
- `role="progressbar"` with live `aria-valuenow`; respects `prefers-reduced-motion`.
- ESM-only with proper `use client` directives — no CJS interop hacks under Vite/Rolldown.

## Usage

Add the component once to your root layout:

```tsx
// app/layout.tsx
import { NavigationProgress } from 'vinext-progress';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <NavigationProgress color="var(--your-brand-color)" />
        {children}
      </body>
    </html>
  );
}
```

### Props

| Prop                | Default             | Description                                                         |
| ------------------- | ------------------- | ------------------------------------------------------------------- |
| `color`             | `#29d`              | Bar color (any CSS color, including `var(...)`)                     |
| `height`            | `3`                 | Bar height in px                                                    |
| `zIndex`            | `1600`              | Stacking order                                                      |
| `ariaLabel`         | `'Page navigation'` | Accessible name                                                     |
| `trackLinkClicks`   | `true`              | Start on same-origin link clicks                                    |
| `trackFormSubmits`  | `true`              | Start on same-origin GET form submissions (`next/form`)             |
| `trackRouterCalls`  | `true`              | Start on `router.push`/`replace` (vinext only; no-op on plain Next) |
| `minimum`           | `0.08`              | Initial progress value                                              |
| `maximum`           | `0.994`             | Trickle upper bound                                                 |
| `trickleSpeed`      | `200`               | ms between trickle increments                                       |
| `speed`             | `200`               | CSS transition duration (ms)                                        |
| `stallTimeoutMs`    | `10000`             | Auto-finish timeout for starts with no observed navigation (ms)     |
| `inFlightTimeoutMs` | `30000`             | Auto-finish timeout once a real navigation is in flight (ms)        |

### Manual control

```tsx
'use client';
import { useNavigationProgress } from 'vinext-progress';

const progress = useNavigationProgress();
progress.start();
progress.set(0.5);
progress.finish();
```

## Known limitations

- A link click whose navigation is canceled via `event.preventDefault()` in user code briefly starts the bar; the stall timeout clears it. (Distinguishing this case is impossible at the document level because the router itself calls `preventDefault()` for every client-side navigation.)
- With a `basePath`, programmatic same-URL detection may start the bar unnecessarily; the settlement watcher, commit watcher, or stall timeout clears it.
- A GET form whose predicted destination (action plus submitted fields, mirroring vinext's own URL construction) equals the current URL does not start the bar — such a submit produces no URL commit to finish on.

## Development

```sh
bun install
bun run build      # tsc → dist/
bun run test:unit  # bun test (progress engine)
bun run test:e2e   # Playwright against a real vinext app in e2e/fixture
```

## License

[Apache License 2.0](LICENSE) © WillBooster Inc.
