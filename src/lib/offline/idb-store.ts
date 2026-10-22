import type { QueueStore, QueuedMutation } from "./types";

const DB_NAME = "homebase-offline";
const STORE = "mutations";
const VERSION = 1;

function promisify<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** IndexedDB-backed queue storage: survives reloads, app restarts and going offline. */
export class IdbQueueStore implements QueueStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly factory: IDBFactory;

  constructor(factory?: IDBFactory) {
    const resolved = factory ?? (typeof indexedDB !== "undefined" ? indexedDB : undefined);
    if (!resolved) throw new Error("IndexedDB is not available in this browser.");
    this.factory = resolved;
  }

  private db(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        const request = this.factory.open(DB_NAME, VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("Could not open offline storage"));
      });
    }
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.db();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  async getAll(): Promise<QueuedMutation[]> {
    const store = await this.tx("readonly");
    return promisify(store.getAll() as IDBRequest<QueuedMutation[]>);
  }

  async put(mutation: QueuedMutation): Promise<void> {
    const store = await this.tx("readwrite");
    await promisify(store.put(mutation));
  }

  async delete(id: string): Promise<void> {
    const store = await this.tx("readwrite");
    await promisify(store.delete(id));
  }

  async clear(): Promise<void> {
    const store = await this.tx("readwrite");
    await promisify(store.clear());
  }
}
