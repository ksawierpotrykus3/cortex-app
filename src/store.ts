// NOTE: This module is not a state store — it's a re-export proxy for the filesystem
// bridge (./fs). Named "store" for historical/compatibility reasons.
import { initFS, connectToLocalFolder, isConnected, loadWorkspace, saveWorkspace, NexusState, defaultState } from './fs';

export { initFS, connectToLocalFolder, isConnected, loadWorkspace, saveWorkspace, defaultState };
export type { NexusState };
