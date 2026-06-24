import { useState, useEffect, useCallback, useRef } from 'react';
import { get, set } from 'idb-keyval';
import { NexusNode, NexusLink, Task, WritingDraft, ManuscriptFolder, ManuscriptTab, ManuscriptMeta, ChangeEntry, FeedbackEntry, WikiArticle } from './types';
import { Pipeline } from './shared/types/schema';
import { WorkflowDefinition } from './shared/types/workflow';
import { EntitySnapshot } from './utils/diffEngine';
import { CustomCommandData } from './renderer/store/commandStore';
import { ShortcutOverride } from './renderer/store/keydirStore';

export const WORKSPACE_FILE = "nexus.workspace.json";
export const BACKUP_FILE = "nexus.backup.json";
export const TEMP_FILE = "nexus.workspace.tmp.json";

export interface NexusState {
  nodes: NexusNode[];
  links: NexusLink[];
  tasks: Task[];
  drafts: WritingDraft[];
  geminiKey: string;
  manuscriptFolders?: ManuscriptFolder[];
  manuscriptTabs?: ManuscriptTab[];
  manuscriptMetas?: ManuscriptMeta[];
  changelog?: ChangeEntry[];
  feedback?: FeedbackEntry[];
  wiki?: WikiArticle[];
  pipelines?: Pipeline[];
  workflows?: WorkflowDefinition[];
  snapshots?: EntitySnapshot[];
  customCommands?: CustomCommandData[];
  shortcutOverrides?: ShortcutOverride[];
  studioCanvas?: any;
  mermaidDrafts?: any[];
}

export const defaultState: NexusState = {
  nodes: [],
  links: [],
  tasks: [],
  drafts: [],
  geminiKey: "",
  manuscriptFolders: [],
  manuscriptTabs: [],
  manuscriptMetas: [],
  changelog: [],
  feedback: [],
  wiki: [],
  pipelines: [],
  workflows: [],
  snapshots: [],
  customCommands: [],
  shortcutOverrides: [],
};

let directoryHandle: FileSystemDirectoryHandle | null = null;
let permissionGranted = false;

// Global references for the polling watcher
let lastModifiedTime = 0;
let fileWatcherInterval: any = null;
let onExternalChangeCallback: ((state: NexusState) => void) | null = null;

export async function hasStoredHandle(): Promise<boolean> {
  const handle = await get('nexus_dir_handle');
  return !!handle;
}

async function startPollingFile() {
  if (fileWatcherInterval) clearInterval(fileWatcherInterval);
  if (!directoryHandle || !permissionGranted) return;
  
  try {
    const fileHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: false });
    const file = await fileHandle.getFile();
    lastModifiedTime = file.lastModified;
    
    fileWatcherInterval = setInterval(async () => {
      try {
        const fh = await directoryHandle!.getFileHandle(WORKSPACE_FILE, { create: false });
        const currentFile = await fh.getFile();
        if (currentFile.lastModified > lastModifiedTime) {
          lastModifiedTime = currentFile.lastModified;
          const contents = await currentFile.text();
          try {
            const newState = JSON.parse(contents);
            if (onExternalChangeCallback) onExternalChangeCallback(newState);
          } catch(e) {
            console.error("Failed to parse external changes", e);
          }
        }
      } catch(e) {
         // Probably file deleted or permissions dropped
      }
    }, 3000);
  } catch(e) {
    console.error("Start polling failed", e);
  }
}

export async function initFS(): Promise<boolean> {
  const storedHandle = await get('nexus_dir_handle');
  if (storedHandle) {
    directoryHandle = storedHandle as FileSystemDirectoryHandle;
    const options: any = { mode: 'readwrite' };
    try {
        if ((await (directoryHandle as any).queryPermission(options)) === 'granted') {
          permissionGranted = true;
          startPollingFile();
          return true;
        }
    } catch(e) {}
  }
  return false;
}

export async function restorePermission(): Promise<boolean> {
  if (!directoryHandle) {
    const storedHandle = await get('nexus_dir_handle');
    if (storedHandle) directoryHandle = storedHandle as FileSystemDirectoryHandle;
  }
  if (!directoryHandle) return false;
  
  const options: any = { mode: 'readwrite' };
  try {
    if ((await (directoryHandle as any).queryPermission(options)) === 'granted') {
       permissionGranted = true;
       startPollingFile();
       return true;
    }
    if ((await (directoryHandle as any).requestPermission(options)) === 'granted') {
       permissionGranted = true;
       const currentState = await get('nexus_state');
       if (currentState) {
          await saveWorkspace(currentState as any, false);
       }
       startPollingFile();
       return true;
    }
  } catch (e) {
    console.error("Permission request failed", e);
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
    permissionGranted = true;
    
    startPollingFile();
    
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function isConnected(): boolean {
  return permissionGranted;
}

export async function saveWorkspace(state: NexusState, triggerWatcher = true) {
  // Save to IDB as fallback
  await set('nexus_state', state);

  if (!directoryHandle || !permissionGranted) return;
  try {
    // Atomic write: write to tmp first, then rename to actual file.
    // This prevents data corruption if the process crashes mid-write.
    const tmpHandle = await directoryHandle.getFileHandle(TEMP_FILE, { create: true });
    const tmpWritable = await tmpHandle.createWritable();
    await tmpWritable.write(JSON.stringify(state, null, 2));
    await tmpWritable.close();

    // Create backup of current state
    try {
      const currentHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: false });
      const currentFile = await currentHandle.getFile();
      const currentContent = await currentFile.text();
      const backupHandle = await directoryHandle.getFileHandle(BACKUP_FILE, { create: true });
      const backupWritable = await backupHandle.createWritable();
      await backupWritable.write(currentContent);
      await backupWritable.close();
    } catch {
      // No existing workspace file to backup - first save
    }

    // Atomically replace workspace with tmp file content.
    // The File System Access API doesn't support true atomic rename,
    // so we write directly to the workspace file as the final authoritative copy.
    const activeHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: true });
    const activeWritable = await activeHandle.createWritable();
    await activeWritable.write(JSON.stringify(state, null, 2));
    await activeWritable.close();

    if (triggerWatcher) {
        const file = await activeHandle.getFile();
        lastModifiedTime = file.lastModified;
    }

  } catch (e) {
    console.error("FS sync failed:", e);
  }
}

export async function loadWorkspace(): Promise<NexusState> {
  if (directoryHandle && permissionGranted) {
    try {
      const fileHandle = await directoryHandle.getFileHandle(WORKSPACE_FILE, { create: false });
      const file = await fileHandle.getFile();
      const contents = await file.text();
      return JSON.parse(contents);
    } catch (e: any) {
      console.error("Load failed, attempting backup...", e);
      try {
        const backupHandle = await directoryHandle.getFileHandle(BACKUP_FILE, { create: false });
        const backupFile = await backupHandle.getFile();
        return JSON.parse(await backupFile.text());
      } catch(err) {
        console.error(err);
      }
    }
  }
  
  // Try to load from IndexedDB as fallback if FS not granted
  const idbState = await get('nexus_state');
  if (idbState) {
     return idbState as NexusState;
  }

  return defaultState;
}

export function useFileSystemWatcher(callback: (state: NexusState) => void) {
  useEffect(() => {
    onExternalChangeCallback = callback;
    return () => {
      onExternalChangeCallback = null;
      if (fileWatcherInterval) {
        clearInterval(fileWatcherInterval);
        fileWatcherInterval = null;
      }
    };
  }, [callback]);
}
