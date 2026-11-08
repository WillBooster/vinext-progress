import type { ReactNode } from 'react';

import { HeavyRender } from './HeavyRender';

export default function HeavyPage(): ReactNode {
  return (
    <main>
      <h1>Heavy page</h1>
      <HeavyRender />
    </main>
  );
}
