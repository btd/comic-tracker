import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Series } from './types';

interface TrackerDB extends DBSchema {
  series: { key: string; value: Series };
}

const DB_NAME = 'comic-tracker';
const DB_VERSION = 1;
const STORE = 'series';

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function getAll(): Promise<Series[]> {
  return (await getDB()).getAll(STORE);
}

export async function get(id: string): Promise<Series | undefined> {
  return (await getDB()).get(STORE, id);
}

export async function put(series: Series): Promise<void> {
  await (await getDB()).put(STORE, series);
}

export async function remove(id: string): Promise<void> {
  await (await getDB()).delete(STORE, id);
}

export async function bulkPut(list: Series[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all([...list.map((s) => tx.store.put(s)), tx.done]);
}

export async function clear(): Promise<void> {
  await (await getDB()).clear(STORE);
}
