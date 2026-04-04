import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          r3f:   ['@react-three/fiber', '@react-three/drei'],
          gsap:  ['gsap'],
        },
      },
    },
  },
});
