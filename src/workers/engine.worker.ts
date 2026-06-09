// NXS-ENG-001: Node-Based AI Engine Worker
import { HitLMessage, PipelinePayload } from '../types';

// Deferred promises registry for HitL & MCP Protocols
type ResolveFn = (val: any) => void;
type RejectFn = (err: Error) => void;

interface PendingTask {
  resolve: ResolveFn;
  reject: RejectFn;
  timer: NodeJS.Timeout;
}

const correlationRegistry = new Map<string, PendingTask>();

// --- Worker Initialization ---
console.log('[Nexus AI Engine] Core Neural Thread Initialized.');

// Main message listener (React UI -> Worker)
self.onmessage = async (event: MessageEvent) => {
  const { type, correlationId, payload, status, error } = event.data;

  // 1. Handle Responses to our suspended promises (HitL / Main thread callbacks)
  if (type.endsWith('_RESPONSE') && correlationRegistry.has(correlationId)) {
    const task = correlationRegistry.get(correlationId)!;
    clearTimeout(task.timer);
    correlationRegistry.delete(correlationId);

    if (status === 'DENIED' || error) {
      task.reject(new Error(error || 'Action denied by Human-in-the-Loop or failed.'));
    } else {
      task.resolve(payload);
    }
    return;
  }

  // 2. Handle Incoming Commands from React (e.g. RUN_PIPELINE)
  if (type === 'RUN_PIPELINE') {
    try {
      console.log(`[Nexus AI Engine] Starting pipeline execution...`);
      // TODO: Implementation of PipelineRunner & Middleware Onion (Faza 8)
      
      self.postMessage({
        type: 'PIPELINE_COMPLETE',
        correlationId,
        payload: { success: true }
      });
    } catch (err: any) {
      self.postMessage({
        type: 'PIPELINE_ERROR',
        correlationId,
        error: err.message
      });
    }
  }
};

// --- HitL Suspended Execution Helper (Asynchronous Spin-Lock bypass) ---
// This allows the Worker to "sleep" while the user reviews the Diff preview in React modal.
export const suspendForHitL = async (payload: any): Promise<any> => {
  const correlationId = self.crypto.randomUUID();

  return new Promise<any>((resolve, reject) => {
    // Tier-2 Security: 5 Minute Timeout for Human Action
    const timer = setTimeout(() => {
      correlationRegistry.delete(correlationId);
      reject(new Error("Timeout: Operator did not respond within the allocated window (5m)."));
    }, 5 * 60 * 1000);

    correlationRegistry.set(correlationId, { resolve, reject, timer });

    // Fire to React and go to sleep
    self.postMessage({
      type: 'HITL_FILE_EDIT_REQUEST',
      correlationId,
      payload
    });
  });
};
