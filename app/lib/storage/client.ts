export interface StorageClient {
  get<T = unknown>(key: string, defaultValue?: T): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

export type StorageEventMap = {
  changed: { key: string };
};

export interface StorageBridge extends StorageClient {
  onChanged?: (handler: (evt: { key: string }) => void) => void;
}

export const storageClient: StorageClient = {
  async get(key, defaultValue) {
    const api = (window as any).storageAPI as StorageBridge | undefined;
    if (!api) return defaultValue as any;
    return api.get(key, defaultValue) as Promise<any>;
  },
  async set(key, value) {
    const api = (window as any).storageAPI as StorageBridge | undefined;
    if (!api) return;
    await api.set(key, value);
  },
  async delete(key) {
    const api = (window as any).storageAPI as StorageBridge | undefined;
    if (!api) return;
    await api.delete(key);
  },
  async clear() {
    const api = (window as any).storageAPI as StorageBridge | undefined;
    if (!api) return;
    await api.clear();
  },
  async has(key) {
    const api = (window as any).storageAPI as StorageBridge | undefined;
    if (!api) return false;
    return api.has(key) as Promise<boolean>;
  }
};


