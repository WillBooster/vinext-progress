'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

export function PushButton(): ReactNode {
  const router = useRouter();
  return (
    <button
      data-testid="push-slow"
      onClick={() => {
        router.push('/slow?via=push');
      }}
      type="button"
    >
      router.push to slow page
    </button>
  );
}
