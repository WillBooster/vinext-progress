import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The e2e fixture aliases vinext-progress to ../../dist, so build the library before every e2e
// run. Building here instead of in webServer.command keeps the build from being skipped when
// Playwright reuses an already-running fixture server (reuseExistingServer).
export default function globalSetup(): void {
  execSync('bun run build', { cwd: fileURLToPath(new URL('../..', import.meta.url)), stdio: 'inherit' });
}
