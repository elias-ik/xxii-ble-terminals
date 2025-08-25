// TypeScript support is now handled by the ES module loader

import { contextBridge, ipcRenderer } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wrap everything in an async function to handle dynamic imports
async function initializePreload() {
  // BLE is handled in main; preload only forwards IPC to renderer

  // Storage via IPC to main process (no direct electron-store usage in preload)

  // Small helper to manage add/remove listener mapping
  function createEventRelay() {
    const maps = {
      scanStatus: new Map(),
      deviceDiscovered: new Map(),
      devicesDiscovered: new Map(),
      deviceUpdated: new Map(),
      connectionChanged: new Map(),
      characteristicValue: new Map(),
      subscriptionChanged: new Map(),
    };

    return {
      onScanStatus(cb) {
        const handler = (_event, payload) => cb({ status: payload.status, deviceCount: payload.deviceCount, error: payload.error });
        maps.scanStatus.set(cb, handler);
        ipcRenderer.on('ble:scanStatus', handler);
      },
      removeScanStatusListener(cb) {
        const handler = maps.scanStatus.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:scanStatus', handler);
          maps.scanStatus.delete(cb);
        }
      },

      onDeviceDiscovered(cb) {
        const handler = (_event, device) => cb({ device });
        maps.deviceDiscovered.set(cb, handler);
        ipcRenderer.on('ble:deviceDiscovered', handler);
      },
      removeDeviceDiscoveredListener(cb) {
        const handler = maps.deviceDiscovered.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:deviceDiscovered', handler);
          maps.deviceDiscovered.delete(cb);
        }
      },

      onDevicesDiscovered(cb) {
        const handler = (_event, devices) => cb({ devices });
        maps.devicesDiscovered.set(cb, handler);
        ipcRenderer.on('ble:devicesDiscovered', handler);
      },
      removeDevicesDiscoveredListener(cb) {
        const handler = maps.devicesDiscovered.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:devicesDiscovered', handler);
          maps.devicesDiscovered.delete(cb);
        }
      },

      onDeviceUpdated(cb) {
        const handler = (_event, device) => cb({ device });
        maps.deviceUpdated.set(cb, handler);
        ipcRenderer.on('ble:deviceUpdated', handler);
      },
      removeDeviceUpdatedListener(cb) {
        const handler = maps.deviceUpdated.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:deviceUpdated', handler);
          maps.deviceUpdated.delete(cb);
        }
      },

      onConnectionChanged(cb) {
        const handler = (_event, evt) => {
          let status = evt.state;
          cb({ deviceId: evt.deviceId, status, connection: evt.connection });
        };
        maps.connectionChanged.set(cb, handler);
        ipcRenderer.on('ble:connectionChanged', handler);
      },
      removeConnectionChangedListener(cb) {
        const handler = maps.connectionChanged.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:connectionChanged', handler);
          maps.connectionChanged.delete(cb);
        }
      },

      onCharacteristicValue(cb) {
        const handler = (_event, evt) => cb({ ...evt, timestamp: new Date() });
        maps.characteristicValue.set(cb, handler);
        ipcRenderer.on('ble:characteristicValue', handler);
      },
      removeCharacteristicValueListener(cb) {
        const handler = maps.characteristicValue.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:characteristicValue', handler);
          maps.characteristicValue.delete(cb);
        }
      },

      onSubscriptionChanged(cb) {
        const handler = (_event, evt) => cb(evt);
        maps.subscriptionChanged.set(cb, handler);
        ipcRenderer.on('ble:subscriptionChanged', handler);
      },
      removeSubscriptionChangedListener(cb) {
        const handler = maps.subscriptionChanged.get(cb);
        if (handler) {
          ipcRenderer.removeListener('ble:subscriptionChanged', handler);
          maps.subscriptionChanged.delete(cb);
        }
      },
    };
  }

  const relay = createEventRelay();

  // Expose BLE API to renderer via context bridge (IPC to main)
  contextBridge.exposeInMainWorld('bleAPI', {
    scan: () => ipcRenderer.invoke('ble:scan'),
    connect: (deviceId) => ipcRenderer.invoke('ble:connect', deviceId),
    disconnect: (deviceId) => ipcRenderer.invoke('ble:disconnect', deviceId),
    read: (deviceId, serviceId, characteristicId) => ipcRenderer.invoke('ble:read', deviceId, serviceId, characteristicId),
    write: (deviceId, serviceId, characteristicId, data) => ipcRenderer.invoke('ble:write', deviceId, serviceId, characteristicId, data),
    subscribe: (deviceId, serviceId, characteristicId, _cb) => ipcRenderer.invoke('ble:subscribe', deviceId, serviceId, characteristicId),
    unsubscribe: (deviceId, serviceId, characteristicId) => ipcRenderer.invoke('ble:unsubscribe', deviceId, serviceId, characteristicId),

    getRSSI: () => null,
    getAdvertisingData: () => null,
    getServices: () => null,
    getCharacteristics: () => null,
    isConnected: () => false,

    onDeviceDiscovered: relay.onDeviceDiscovered,
    onDevicesDiscovered: relay.onDevicesDiscovered,
    onDeviceUpdated: relay.onDeviceUpdated,
    onConnectionChanged: relay.onConnectionChanged,
    onCharacteristicValue: relay.onCharacteristicValue,
    onSubscriptionChanged: relay.onSubscriptionChanged,
    onScanStatus: relay.onScanStatus,

    removeDeviceDiscoveredListener: relay.removeDeviceDiscoveredListener,
    removeDevicesDiscoveredListener: relay.removeDevicesDiscoveredListener,
    removeDeviceUpdatedListener: relay.removeDeviceUpdatedListener,
    removeConnectionChangedListener: relay.removeConnectionChangedListener,
    removeCharacteristicValueListener: relay.removeCharacteristicValueListener,
    removeSubscriptionChangedListener: relay.removeSubscriptionChangedListener,
    removeScanStatusListener: relay.removeScanStatusListener,
  });

  // Expose simple key/value storage API
  contextBridge.exposeInMainWorld('storageAPI', {
    get: (key, defaultValue) => ipcRenderer.invoke('storage:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('storage:set', key, value),
    delete: (key) => ipcRenderer.invoke('storage:delete', key),
    clear: () => ipcRenderer.invoke('storage:clear'),
    has: (key) => ipcRenderer.invoke('storage:has', key),
  });

  // Minimal Electron info
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: process.versions,
    isElectron: true,
  });

  // Surface runtime errors to main process console
  window.addEventListener('error', (event) => {
    console.error('Renderer error:', event.error || event.message);
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
  });

  console.log('Preload initialized with ts-node; BLE client bridged');
}

// Initialize the preload script
initializePreload().catch(error => {
  console.error('Failed to initialize preload script:', error);
});
