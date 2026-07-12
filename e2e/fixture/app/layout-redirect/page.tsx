'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useLayoutEffect } from 'react';

export default function LayoutRedirectPage(): ReactNode {
  const router = useRouter();
  // A mount-time layout effect runs after this page's commit but before the
  // commit watcher's passive effect, exercising the premature-finish race.
  useLayoutEffect(() => {
    router.push('/slow?via=layout-redirect');
  }, [router]);
  return <h1>Redirecting</h1>;
}
