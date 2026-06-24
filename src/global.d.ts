// ============================================================================
// NEXUS — Global type declarations
// ============================================================================

import type { NexusBridge } from './shared/types/ipc';

declare global {
  interface Window {
    nexusBridge?: NexusBridge;
  }
}
