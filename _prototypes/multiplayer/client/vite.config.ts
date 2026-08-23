import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3000,
    // Native filesystem events do not cross the bind mount from the Windows host
    // into the Linux container, same problem api/ and web/ hit. Vite's watcher
    // needs the same poll fix.
    watch: { usePolling: true, interval: 300 },
  },
});
