import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',

  plugins: [react()],

  server: {
    host: true,
    port: 5173,
  },

  preview: {
    host: true,
    port: 4173,
    allowedHosts: ['blackhole-3d-pwacademy.up.railway.app'],
  },

  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1400,

    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
});
