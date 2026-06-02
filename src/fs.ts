export const WORKSPACE_FILE = "nexus.workspace.json";
export const BACKUP_FILE = "nexus.backup.json";

export interface NexusState {
  nodes: any[];
  links: any[];
  tasks: any[];
  drafts: any[];
  axioms: {id: string, text: string}[];
  geminiKey: string;
}

export const defaultState: NexusState = {
  nodes: [],
  links: [],
  tasks: [],
  drafts: [],
  axioms: [],
  geminiKey: ""
};

let directoryHandle: FileSystemDirectoryHandle | null = null;

// Store handle across reloads if possible via IndexedDB
import { get, set } from 'idb-keyval';

export async function initFS(): Promise<boolean> {
  const storedHandle = await get('nexus_dir_handle');
  if (storedHandle) {
    if (await verifyPermission(storedHandle, true)) {
      directoryHandle = storedHandle as FileSystemDirectoryHandle;
      return true;
    }
  }
  return false;
}

export async function connectToLocalFolder(): Promise<boolean> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      id: "nexus_workspace",
      mode: "readwrite",
      startIn: "documents"
    });
    await set('nexus_dir_handle', handle);
    directoryHandle = handle;
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function isConnected(): boolean {
  return directoryHandle !== null;
}

export async function saveWorkspace(state: NexusState) {
  if (!directoryHandle) return;
  try {
    const fileHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(state, null, 2));
    await writable.close();

    // Backup
    const backupHandle = await directoryHandle.getFileHandle(BACKUP_FILE, { create: true });
    const backupWritable = await backupHandle.createWritable();
    await backupWritable.write(JSON.stringify(state, null, 2));
    await backupWritable.close();
  } catch (e) {
    console.error("Save failed:", e);
  }
}

export async function loadWorkspace(): Promise<NexusState> {
  if (!directoryHandle) return defaultState;
  try {
    const fileHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: false });
    const file = await fileHandle.getFile();
    const contents = await file.text();
    return JSON.parse(contents);
  } catch (e: any) {
    if (e.name === "NotFoundError" || e.name === "NotAllowedError") {
      // File missing means empty state
      return defaultState;
    }
    console.error("Load failed, attempting backup...", e);
    try {
      const backupHandle = await directoryHandle.getFileHandle(BACKUP_FILE, { create: false });
      const backupFile = await backupHandle.getFile();
      return JSON.parse(await backupFile.text());
    } catch(err) {
      console.error(err);
      return defaultState;
    }
  }
}

async function verifyPermission(fileHandle: any, readWrite: boolean) {
  const options: any = {};
  if (readWrite) {
    options.mode = 'readwrite';
  }
  
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}
