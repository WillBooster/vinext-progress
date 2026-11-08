'use client';

import type { ReactNode } from 'react';

const CHUNK_COUNT = 20;
const CHUNK_RENDER_MS = 30;

/**
 * Renders in many short synchronous chunks whose total exceeds the bar's trickle interval, so React
 * yields between chunks and a concurrent update arriving meanwhile restarts the navigation's render.
 */
export function HeavyRender(): ReactNode {
  return Array.from({ length: CHUNK_COUNT }, (_, index) => <SlowChunk index={index} key={index} />);
}

function SlowChunk({ index }: { index: number }): ReactNode {
  const end = performance.now() + CHUNK_RENDER_MS;
  while (performance.now() < end) {
    // Busy-wait to simulate an expensive render on a slow device.
  }
  return <p>Chunk {index + 1}</p>;
}
