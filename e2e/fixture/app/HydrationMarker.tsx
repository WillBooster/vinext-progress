'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

/** Lets E2E tests wait for hydration before interacting with the page. */
export function HydrationMarker(): ReactNode {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated ? <div data-testid="hydrated" /> : undefined;
}
