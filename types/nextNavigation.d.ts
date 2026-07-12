/**
 * Minimal local declaration so the library compiles without depending on the
 * `next` package. At runtime, `next/navigation` is resolved by the consuming
 * app — vinext aliases it to its own shim. This file is not published.
 */
declare module 'next/navigation' {
  export function usePathname(): string;
  export function useSearchParams(): URLSearchParams | undefined;
}
