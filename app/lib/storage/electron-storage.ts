import type { Storage } from './types';

export const electronStorage: Storage = {
  async get(key, defaultValue) {
    const api = (window as any).storageAPI;
    if (!api) return defaultValue as any;
    return api.get(key, defaultValue);
  },
  async set(key, value) {
    const api = (window as any).storageAPI;
    if (!api) return;
    await api.set(key, value);
  },
  async delete(key) {
    const api = (window as any).storageAPI;
    if (!api) return;
    await api.delete(key);
  },
  async clear() {
    const api = (window as any).storageAPI;
    if (!api) return;
    await api.clear();
  },
  async has(key) {
    const api = (window as any).storageAPI;
    if (!api) return false;
    return api.has(key);
  }
};


