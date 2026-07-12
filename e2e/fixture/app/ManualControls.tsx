'use client';

import type { ReactNode } from 'react';
import { useNavigationProgress } from 'vinext-progress';

/** Exercises manual bar control plus an "idle commit" that vinext processes without a pending navigation. */
export function ManualControls(): ReactNode {
  const progress = useNavigationProgress();
  return (
    <>
      <button
        data-testid="manual-start"
        onClick={() => {
          progress.start();
        }}
        type="button"
      >
        Start bar manually
      </button>
      <button
        data-testid="idle-commit"
        onClick={() => {
          // vinext's patched replaceState runs commitClientNavigationState,
          // which rewrites pendingPathname = null even when already null.
          history.replaceState(history.state, '', location.href);
        }}
        type="button"
      >
        Trigger idle history commit
      </button>
    </>
  );
}
