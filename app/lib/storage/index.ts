import type { Storage } from './types';
import { electronStorage } from './electron-storage';
import { memoryStorage } from './memory-storage';

export type { Storage } from './types';

// Prefer electron storage when available
export const storage: Storage = typeof window !== 'undefined' && (window as any).storageAPI
  ? electronStorage
  : memoryStorage;


