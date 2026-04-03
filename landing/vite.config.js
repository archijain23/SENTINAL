import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@animations': path.resolve(__dirname, './src/animations'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@scenes': path.resolve(__dirname, './src/scenes'),
      '@styles': path.resolve(__dirname, './src/styles'),
    },
    // Enforce single copies — stops Vite from bundling two React or Three instances
    dedupe: ['react', 'react-dom', 'three', '@react-three/fiber'],
  },

  optimizeDeps: {
    // CRITICAL: include R3F packages so Vite pre-bundles them as one
    // self-contained CJS→ESM chunk. Without this, Vite resolves each
    // internal import separately and can pick the wrong react-reconciler.
    include: [
      'react',
      'react-dom',
      'three',
      'gsap',
      '@react-three/fiber',
      '@react-three/drei',
    ],
    // Exclude broken source-map package — prevents the ENOENT warning
    exclude: ['@mediapipe/tasks-vision'],
    // Force Vite to re-discover deps after clean install
    force: false,
  },

  build: {
    target: 'es2020',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: { drop_console: true, drop_debugger: true },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-three': ['three'],
          'vendor-r3f':   ['@react-three/fiber', '@react-three/drei'],
          'vendor-gsap':  ['gsap'],
        },
        chunkFileNames:  'assets/[name]-[hash].js',
        entryFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
      },
    },
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
  },

  server: {
    port: 5173,
    open: true,
    hmr: { overlay: true },
  },

  preview: { port: 4173 },
});
