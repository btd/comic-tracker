import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Meta, Series } from './types';
import { DEFAULT_META } from './types';

interface TrackerDB extends DBSchema {
  series: { key: string; value: Series };
  meta: { key: string; value: unknown };
}

const DB_NAME = 'comic-tracker';
const DB_VERSION = 2;
const STORE = 'series';
const META_STORE = 'meta';
const META_KEY = 'app';

let dbPromise: Promise<IDBPDatabase<TrackerDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TrackerDB>> {
  if (!dbPromise) {
    dbPromise = openDB<TrackerDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
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

export async function getMeta(): Promise<Meta> {
  const stored = (await (await getDB()).get(META_STORE, META_KEY)) as Partial<Meta> | undefined;
  return { ...DEFAULT_META, ...(stored ?? {}) };
}

export async function setMeta(patch: Partial<Meta>): Promise<void> {
  const next = { ...(await getMeta()), ...patch };
  await (await getDB()).put(META_STORE, next, META_KEY);
}
