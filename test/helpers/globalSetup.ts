import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Rebuild when Playwright reuses an already-running fixture server and skips webServer.command.
export default function globalSetup(): void {
  execSync('bun run build', { cwd: fileURLToPath(new URL('../..', import.meta.url)), stdio: 'inherit' });
}
