// ============================================================================
// NEXUS — Global type declarations
// ============================================================================

import type { NexusBridge } from './shared/types/ipc';

declare global {
  interface Window {
    nexusBridge?: NexusBridge;
  }

  interface ImportMetaEnv {
    VITE_PROXY_URL?: string;
    [key: string]: unknown;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}
