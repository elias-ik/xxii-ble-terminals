import type { Storage } from './types';

const memory = new Map<string, unknown>();

export const memoryStorage: Storage = {
  async get(key, defaultValue) {
    return (memory.has(key) ? (memory.get(key) as any) : defaultValue) as any;
  },
  async set(key, value) {
    memory.set(key, value);
  },
  async delete(key) {
    memory.delete(key);
  },
  async clear() {
    memory.clear();
  },
  async has(key) {
    return memory.has(key);
  },
};


