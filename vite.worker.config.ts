import path from 'path';
import { defineConfig } from 'vite';

// --- NXS-ENG-001 (Multi-Build Pipeline for AI Worker) ---
// This guarantees deterministic path resolution and escapes Rollup bugs in Electron
export default defineConfig({
  build: {
    outDir: path.resolve(__dirname, 'dist/worker'),
    lib: {
      entry: path.resolve(__dirname, 'src/workers/engine.worker.ts'),
      name: 'EngineWorker',
      formats: ['iife'], // Immune to strict module constraints
      fileName: () => 'engine.worker.js'
    },
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV === 'development'
  }
});
