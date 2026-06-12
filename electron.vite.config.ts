// ============================================================================
// NEXUS — electron.vite.config.ts
// Konfiguracja electron-vite: 3 targety (main, preload, renderer)
// Zastępuje stary scripts/build.ts + vite.config.ts
// ============================================================================

import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: path.join(__dirname, 'src/main/index.ts'),
        },
        output: {
          format: 'cjs',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      conditions: ['node'],
    },
  },

  preload: {
    build: {
      rollupOptions: {
        input: {
          preload: path.join(__dirname, 'src/main/preload.ts'),
        },
        output: {
          format: 'cjs',
        },
      },
    },
    plugins: [externalizeDepsPlugin()],
  },

  renderer: {
    root: __dirname,
    build: {
      rollupOptions: {
        input: {
          renderer: path.join(__dirname, 'index.html'),
        },
        output: {
          format: 'es',
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    plugins: [react(), tailwindcss()],
    server: {
      port: 3000,
    },
  },
})
