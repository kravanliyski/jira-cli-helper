import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'], // Modern ESM format
  clean: true, // Delete dist folder before building
  banner: {
    js: '#!/usr/bin/env node', // This adds the shebang automatically
  },
});
