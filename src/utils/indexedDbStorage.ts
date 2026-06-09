import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { NodeSnapshot } from '../types';

interface NexusDBSchema extends DBSchema {
  execution_snapshots: {
    key: string;
    value: NodeSnapshot;
    indexes: {
      'by-pipeline': string;
      'by-parent': string;
    };
  };
}

const DB_NAME = 'nexus-ai-engine';
const DB_VERSION = 1;

export const initDB = async (): Promise<IDBPDatabase<NexusDBSchema>> => {
  return openDB<NexusDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('execution_snapshots')) {
        const store = db.createObjectStore('execution_snapshots', {
          keyPath: 'id',
        });
        store.createIndex('by-pipeline', 'pipelineId');
        store.createIndex('by-parent', 'parentId');
      }
    },
  });
};

export const saveSnapshot = async (snapshot: NodeSnapshot): Promise<void> => {
  const db = await initDB();
  await db.put('execution_snapshots', snapshot);
};

export const getSnapshot = async (id: string): Promise<NodeSnapshot | undefined> => {
  const db = await initDB();
  return db.get('execution_snapshots', id);
};

export const getPipelineSnapshots = async (pipelineId: string): Promise<NodeSnapshot[]> => {
  const db = await initDB();
  return db.getAllFromIndex('execution_snapshots', 'by-pipeline', pipelineId);
};

// DAG Pruner: Recursively deletes a snapshot and all its children.
// Essential for Fork & Resume (Time Travel) to prevent DB bloating and Zombie branches.
export const pruneDeadBranch = async (snapshotId: string): Promise<void> => {
  const db = await initDB();
  const tx = db.transaction('execution_snapshots', 'readwrite');
  const store = tx.objectStore('execution_snapshots');
  const index = store.index('by-parent');

  const deleteRecursive = async (id: string) => {
    // Delete the current node
    await store.delete(id);
    // Find all children where parentId === id
    const children = await index.getAllKeys(id);
    for (const childId of children) {
      await deleteRecursive(childId);
    }
  };

  await deleteRecursive(snapshotId);
  await tx.done;
};
