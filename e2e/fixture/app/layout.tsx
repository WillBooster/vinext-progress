import type { ReactNode } from 'react';
import { NavigationProgress } from 'vinext-progress';

import { HydrationMarker } from './HydrationMarker';

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    <html lang="en">
      <body>
        {/* Short in-flight budget so the hung-navigation E2E test completes quickly. */}
        <NavigationProgress inFlightTimeoutMs={3000} />
        <HydrationMarker />
        {children}
      </body>
    </html>
  );
}
