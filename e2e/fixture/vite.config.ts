import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import vinext from 'vinext';

export default defineConfig({
  plugins: [vinext()],
  resolve: {
    // The fixture consumes the built library directly; bun cannot express a
    // child-workspace dependency on the repository root package.
    alias: {
      'vinext-progress': fileURLToPath(new URL('../../dist/index.js', import.meta.url)),
    },
  },
});
