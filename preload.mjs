// TypeScript support is now handled by the ES module loader

import { contextBridge } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Wrap everything in an async function to handle dynamic imports
async function initializePreload() {
  // Import the shared BLE client directly from TypeScript
  // Note: path is relative to project root where preload.mjs lives
  const { bleClient } = await import('./app/lib/ble/client.ts');
  // Storage (electron-store)
  const { default: Store } = await import('electron-store');

  // Small helper to manage add/remove listener mapping
  function createEventRelay() {
    const maps = {
      scanStatus: new Map(),
      deviceDiscovered: new Map(),
      deviceUpdated: new Map(),
      connectionChanged: new Map(),
      characteristicValue: new Map(),
      subscriptionChanged: new Map(),
    };

    return {
      onScanStatus(cb) {
        const handler = (payload) => cb({ status: payload.status, deviceCount: payload.deviceCount, error: payload.error });
        maps.scanStatus.set(cb, handler);
        bleClient.on('scanStatus', handler);
      },
      removeScanStatusListener(cb) {
        const handler = maps.scanStatus.get(cb);
        if (handler) {
          bleClient.off('scanStatus', handler);
          maps.scanStatus.delete(cb);
        }
      },

      onDeviceDiscovered(cb) {
        const handler = (device) => cb({ device });
        maps.deviceDiscovered.set(cb, handler);
        bleClient.on('deviceDiscovered', handler);
      },
      removeDeviceDiscoveredListener(cb) {
        const handler = maps.deviceDiscovered.get(cb);
        if (handler) {
          bleClient.off('deviceDiscovered', handler);
          maps.deviceDiscovered.delete(cb);
        }
      },

      onDeviceUpdated(cb) {
        const handler = (device) => cb({ device });
        maps.deviceUpdated.set(cb, handler);
        bleClient.on('deviceUpdated', handler);
      },
      removeDeviceUpdatedListener(cb) {
        const handler = maps.deviceUpdated.get(cb);
        if (handler) {
          bleClient.off('deviceUpdated', handler);
          maps.deviceUpdated.delete(cb);
        }
      },

      onConnectionChanged(cb) {
        const handler = (evt) => {
          // Map state -> status expected by renderer types
          let status = evt.state;
          cb({ deviceId: evt.deviceId, status, connection: evt.connection });
        };
        maps.connectionChanged.set(cb, handler);
        bleClient.on('connectionChanged', handler);
      },
      removeConnectionChangedListener(cb) {
        const handler = maps.connectionChanged.get(cb);
        if (handler) {
          bleClient.off('connectionChanged', handler);
          maps.connectionChanged.delete(cb);
        }
      },

      onCharacteristicValue(cb) {
        const handler = (evt) => cb({ ...evt, timestamp: new Date() });
        maps.characteristicValue.set(cb, handler);
        bleClient.on('characteristicValue', handler);
      },
      removeCharacteristicValueListener(cb) {
        const handler = maps.characteristicValue.get(cb);
        if (handler) {
          bleClient.off('characteristicValue', handler);
          maps.characteristicValue.delete(cb);
        }
      },

      onSubscriptionChanged(cb) {
        const handler = (evt) => cb(evt);
        maps.subscriptionChanged.set(cb, handler);
        bleClient.on('subscriptionChanged', handler);
      },
      removeSubscriptionChangedListener(cb) {
        const handler = maps.subscriptionChanged.get(cb);
        if (handler) {
          bleClient.off('subscriptionChanged', handler);
          maps.subscriptionChanged.delete(cb);
        }
      },
    };
  }

  const relay = createEventRelay();

  // Expose BLE API to renderer via context bridge
  contextBridge.exposeInMainWorld('bleAPI', {
    scan: () => bleClient.scan(),
    connect: (deviceId) => bleClient.connect(deviceId),
    disconnect: (deviceId) => bleClient.disconnect(deviceId),
    read: (deviceId, serviceId, characteristicId) => bleClient.read(deviceId, serviceId, characteristicId),
    write: (deviceId, serviceId, characteristicId, data) => bleClient.write(deviceId, serviceId, characteristicId, data),
    subscribe: (deviceId, serviceId, characteristicId, _cb) => bleClient.subscribe(deviceId, serviceId, characteristicId),
    unsubscribe: (deviceId, serviceId, characteristicId) => bleClient.unsubscribe(deviceId, serviceId, characteristicId),

    getRSSI: () => null,
    getAdvertisingData: () => null,
    getServices: () => null,
    getCharacteristics: () => null,
    isConnected: () => false,

    onDeviceDiscovered: relay.onDeviceDiscovered,
    onDeviceUpdated: relay.onDeviceUpdated,
    onConnectionChanged: relay.onConnectionChanged,
    onCharacteristicValue: relay.onCharacteristicValue,
    onSubscriptionChanged: relay.onSubscriptionChanged,
    onScanStatus: relay.onScanStatus,

    removeDeviceDiscoveredListener: relay.removeDeviceDiscoveredListener,
    removeDeviceUpdatedListener: relay.removeDeviceUpdatedListener,
    removeConnectionChangedListener: relay.removeConnectionChangedListener,
    removeCharacteristicValueListener: relay.removeCharacteristicValueListener,
    removeSubscriptionChangedListener: relay.removeSubscriptionChangedListener,
    removeScanStatusListener: relay.removeScanStatusListener,
  });

  // Expose simple key/value storage API
  const store = new Store({ name: 'app-settings' });
  contextBridge.exposeInMainWorld('storageAPI', {
    get: (key, defaultValue) => Promise.resolve(store.get(key, defaultValue)),
    set: (key, value) => Promise.resolve(store.set(key, value)),
    delete: (key) => Promise.resolve(store.delete(key)),
    clear: () => Promise.resolve(store.clear()),
    has: (key) => Promise.resolve(store.has(key)),
  });

  // Minimal Electron info
  contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    versions: process.versions,
    isElectron: true,
  });

  console.log('Preload initialized with ts-node; BLE client bridged');
}

// Initialize the preload script
initializePreload().catch(error => {
  console.error('Failed to initialize preload script:', error);
});
