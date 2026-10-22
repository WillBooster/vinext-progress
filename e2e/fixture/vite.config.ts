import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import vinext from 'vinext';

export default defineConfig({
  // The e2e tests deliberately exercise the library as published, without React Compiler output.
  plugins: [vinext({ react: { compiler: false } })],
  resolve: {
    // The fixture consumes the built library directly; bun cannot express a
    // child-workspace dependency on the repository root package.
    alias: {
      'vinext-progress': fileURLToPath(new URL('../../dist/index.js', import.meta.url)),
    },
  },
});
