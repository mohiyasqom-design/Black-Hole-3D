import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Relative base so the build also works from a sub-folder or file server.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: { host: true, port: 4173 },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: { manualChunks: { three: ['three'], react: ['react', 'react-dom'] } },
    },
  },
});
