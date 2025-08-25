// Environment helpers for UI

export const isElectron: boolean = ((): boolean => {
  try {
    return typeof window !== 'undefined' && !!(window as any).electronAPI?.isElectron;
  } catch {
    return false;
  }
})();


