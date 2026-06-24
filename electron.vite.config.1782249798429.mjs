// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
var __electron_vite_injected_dirname = "C:\\Users\\Ksawier\\Pictures\\Screenshots\\nexus";
var electron_vite_config_default = defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: {
          index: path.join(__electron_vite_injected_dirname, "src/main/index.ts")
        },
        output: {
          format: "cjs"
        }
      }
    },
    plugins: [externalizeDepsPlugin()],
    resolve: {
      conditions: ["node"]
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: path.join(__electron_vite_injected_dirname, "src/main/preload.ts")
        },
        output: {
          format: "cjs",
          entryFileNames: "index.js"
        }
      }
    },
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: __electron_vite_injected_dirname,
    build: {
      rollupOptions: {
        input: {
          renderer: path.join(__electron_vite_injected_dirname, "index.html")
        },
        output: {
          format: "es"
        }
      },
      // Don't add crossorigin attribute — Electron loads from file://
      modulePreload: false,
      cssCodeSplit: false
    },
    resolve: {
      alias: {
        "@": path.resolve(__electron_vite_injected_dirname, ".")
      }
    },
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "remove-crossorigin",
        transformIndexHtml: (html) => html.replace(/\bcrossorigin\b/g, "")
      }
    ],
    server: {
      port: 3e3
    }
  }
});
export {
  electron_vite_config_default as default
};
