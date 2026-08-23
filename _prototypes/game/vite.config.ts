import { defineConfig } from 'vite';

// The prototype lives in _prototypes/game but reads its art straight out of
// the repo's assets/ folder. Nothing is copied: assets/ stays the single source of
// truth, and the generators there stay the source of truth for the art itself.
//
// Everything outside this folder is imported through src/resources.ts, so this is
// the only place the dev server needs widening.
export default defineConfig({
  server: {
    fs: {
      // ../.. is the repo root, which is where assets/ lives.
      allow: ['../..'],
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Rocket sheets are ~460KB each and the heliopause is 1.5MB. Inlining any of
    // that would be a mistake, so keep everything as separate emitted files.
    assetsInlineLimit: 0,
  },
});
