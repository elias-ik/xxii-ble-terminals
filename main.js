import { app, BrowserWindow, ipcMain } from 'electron';
import Store from 'electron-store';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Better development detection
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Initialize app-wide store in the main process
const appStore = new Store({ name: 'app-settings' });

// ----------------------------------------------------------------------------
// BLE in main process (scanning and connections live off the renderer)
// ----------------------------------------------------------------------------

let BluetoothCtor = null;
async function getBluetoothCtor() {
  if (!BluetoothCtor) {
    const mod = await import('webbluetooth');
    BluetoothCtor = mod.Bluetooth;
  }
  return BluetoothCtor;
}

const bleState = {
  subscriptions: new Map(),
  discoveredDevices: new Map(),
  activeConnections: new Map(),
};

function key(deviceId, serviceId, characteristicId) {
  return `${deviceId}|${serviceId}|${characteristicId}`;
}

function getDisplayUuid(uuid) {
  if (!uuid) return uuid;
  const u = uuid.toLowerCase();
  const base = '-0000-1000-8000-00805f9b34fb';
  if (u.length === 36 && u.endsWith(base) && u.startsWith('0000')) {
    return u.slice(4, 8).toUpperCase();
  }
  return uuid;
}

async function listRootServices(server) {
  const byUuid = new Map();
  const addServicesToMap = (list) => {
    if (Array.isArray(list)) {
      for (const s of list) {
        if (s && s.uuid && !byUuid.has(s.uuid)) byUuid.set(s.uuid, s);
      }
    }
  };
  try { if (typeof server.getPrimaryServices === 'function') addServicesToMap(await server.getPrimaryServices()); } catch {}
  try { if (typeof server.getServices === 'function') addServicesToMap(await server.getServices()); } catch {}
  try { if (typeof server.getIncludedServices === 'function') addServicesToMap(await server.getIncludedServices()); } catch {}
  return Array.from(byUuid.values());
}

async function getNativeService(deviceId, serviceId) {
  const meta = bleState.activeConnections.get(deviceId);
  if (!meta) throw new Error('Not connected');
  if (meta.services.has(serviceId)) return meta.services.get(serviceId);
  const svc = await meta.server.getPrimaryService(serviceId);
  meta.services.set(serviceId, svc);
  return svc;
}

async function getNativeCharacteristic(deviceId, serviceId, characteristicId) {
  const meta = bleState.activeConnections.get(deviceId);
  if (!meta) throw new Error('Not connected');
  const keyId = key(deviceId, serviceId, characteristicId);
  if (meta.characteristics.has(keyId)) return meta.characteristics.get(keyId);
  const svc = await getNativeService(deviceId, serviceId);
  const ch = await svc.getCharacteristic(characteristicId);
  meta.characteristics.set(keyId, ch);
  return ch;
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send(channel, payload); } catch {}
  }
}

function registerIpcHandlers() {
  // Storage IPC (all async)
  ipcMain.handle('storage:get', (_event, key, defaultValue) => {
    return appStore.get(key, defaultValue);
  });
  ipcMain.handle('storage:set', (_event, key, value) => {
    appStore.set(key, value);
    return true;
  });
  ipcMain.handle('storage:delete', (_event, key) => {
    appStore.delete(key);
    return true;
  });
  ipcMain.handle('storage:clear', () => {
    appStore.clear();
    return true;
  });
  ipcMain.handle('storage:has', (_event, key) => {
    return appStore.has(key);
  });

  // ------------------------------
  // BLE IPC
  // ------------------------------

  ipcMain.handle('ble:scan', async () => {
    try {
      broadcast('ble:scanStatus', { status: 'scanning' });
      const Bluetooth = await getBluetoothCtor();

      const seen = new Set();
      let lastFoundAt = Date.now();
      let keepGoing = true;
      const idleLimitMs = 10000;
      const maxTotalMs = 60000;
      const startedAt = Date.now();
      const pending = new Map();

      const flush = () => {
        if (pending.size) {
          const batch = Array.from(pending.values());
          pending.clear();
          broadcast('ble:devicesDiscovered', batch);
        }
      };
      
      // Add a debounced flush to reduce update frequency
      let debouncedFlushTimer = null;
      const debouncedFlush = () => {
        if (debouncedFlushTimer) {
          clearTimeout(debouncedFlushTimer);
        }
        debouncedFlushTimer = setTimeout(() => {
          flush();
          debouncedFlushTimer = null;
        }, 100); // 100ms debounce
      };

      const runOnce = async () => {
        const bt = new Bluetooth({
          allowAllDevices: true,
          scanTime: 2,
          deviceFound: (device, selectFn) => {
            const id = device?.id || device?.address || device?.name || String(Math.random());
            if (!seen.has(id)) {
              const rawName = device?.name || 'Generic BLE Device';
              const unsupportedRegex = /Unknown or Unsupported Device (.*)/;
              const deviceName = unsupportedRegex.test(device?.name ?? '') ? 'Unsupported' : rawName;
              bleState.discoveredDevices.set(id, device);
              seen.add(id);
              lastFoundAt = Date.now();
              const rssi = (device?._adData?.rssi ?? -100);
              pending.set(id, {
                id,
                name: deviceName,
                address: id,
                rssi,
                connected: false,
                lastSeen: new Date(),
                previouslyConnected: false,
                connectionStatus: 'disconnected'
              });
            }
            try { selectFn(); } catch {}
            return true;
          }
        });
        try {
          await bt.requestDevice({ acceptAllDevices: true, optionalServices: [] });
        } catch {}
        debouncedFlush();
      };

      while (keepGoing) {
        await runOnce();
        const idleMs = Date.now() - lastFoundAt;
        const totalMs = Date.now() - startedAt;
        if (idleMs >= idleLimitMs || totalMs >= maxTotalMs) keepGoing = false;
      }

      // Clear any pending debounced flush and do final flush
      if (debouncedFlushTimer) {
        clearTimeout(debouncedFlushTimer);
        debouncedFlushTimer = null;
      }
      flush();
      broadcast('ble:scanStatus', { status: 'completed', deviceCount: seen.size });
    } catch (error) {
      console.error('[BLE] scan() failed', error);
      broadcast('ble:scanStatus', { status: 'failed', error: String(error?.message || error) });
    }
  });

  ipcMain.handle('ble:connect', async (_e, deviceId) => {
    try {
      broadcast('ble:connectionChanged', { deviceId, state: 'connecting' });
      const existing = bleState.activeConnections.get(deviceId);
      if (existing?.server?.connected) {
        const connection = {
          deviceId,
          connected: true,
          services: existing.uiServices || {},
          connectedAt: new Date()
        };
        broadcast('ble:connectionChanged', { deviceId, state: 'connected', connection });
        return;
      }
      const device = bleState.discoveredDevices.get(deviceId);
      if (!device) throw new Error('Device not found in cache');
      const server = await device.gatt.connect();
      const svcMap = {};
      const nativeServices = new Map();
      const nativeChars = new Map();
      const seenServiceUuids = new Set();
      const queue = await listRootServices(server);
      while (queue.length > 0) {
        const svc = queue.shift();
        if (!svc || seenServiceUuids.has(svc.uuid)) continue;
        seenServiceUuids.add(svc.uuid);
        nativeServices.set(svc.uuid, svc);
        try {
          const included = await svc.getIncludedServices();
          if (Array.isArray(included)) {
            for (const inc of included) if (inc && !seenServiceUuids.has(inc.uuid)) queue.push(inc);
          }
        } catch {}
        const chMap = {};
        try {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            nativeChars.set(key(device.id || deviceId, svc.uuid, ch.uuid), ch);
            const props = ch.properties || {};
            chMap[ch.uuid] = {
              uuid: ch.uuid,
              name: getDisplayUuid(ch.uuid),
              capabilities: {
                read: !!props.read,
                write: !!props.write,
                writeNoResp: !!props.writeWithoutResponse,
                notify: !!props.notify,
                indicate: !!props.indicate,
              },
              subscribed: false,
            };
          }
        } catch {}
        svcMap[svc.uuid] = { uuid: svc.uuid, name: getDisplayUuid(svc.uuid), characteristics: chMap };
      }
      // Set up disconnection monitoring for this device
      const handleDisconnection = async () => {
        console.log('[BLE] Device disconnected unexpectedly:', deviceId);
        // Clean up the connection state
        bleState.activeConnections.delete(deviceId);
        // Clear any subscriptions for this device
        for (const k of Array.from(bleState.subscriptions.keys())) {
          if (k.startsWith(`${deviceId}|`)) {
            try { 
              const stop = bleState.subscriptions.get(k); 
              stop && (await stop()); 
            } catch {}
            bleState.subscriptions.delete(k);
          }
        }
        // Notify the renderer about the disconnection
        broadcast('ble:connectionChanged', { deviceId, state: 'lost' });
      };

      // Listen for disconnection events
      if (server.addEventListener) {
        server.addEventListener('gattserverdisconnected', handleDisconnection);
      }

      bleState.activeConnections.set(device.id || deviceId, { 
        device, 
        server, 
        services: nativeServices, 
        characteristics: nativeChars, 
        uiServices: svcMap,
        disconnectHandler: handleDisconnection // Store the handler for cleanup
      });
      
      const connection = { deviceId: device.id || deviceId, connected: true, services: svcMap, connectedAt: new Date() };
      broadcast('ble:connectionChanged', { deviceId: device.id || deviceId, state: 'connected', connection });
    } catch (error) {
      console.error('[BLE] connect() failed', error);
      broadcast('ble:connectionChanged', { deviceId, state: 'lost' });
    }
  });

  ipcMain.handle('ble:disconnect', async (_e, deviceId) => {
    broadcast('ble:connectionChanged', { deviceId, state: 'disconnecting' });
    try {
      const meta = bleState.activeConnections.get(deviceId);
      if (meta?.server?.connected) {
        try { meta.server.disconnect(); } catch {}
      }
      // Remove the disconnection event listener
      if (meta?.disconnectHandler && meta?.server?.removeEventListener) {
        meta.server.removeEventListener('gattserverdisconnected', meta.disconnectHandler);
      }
      for (const k of Array.from(bleState.subscriptions.keys())) {
        if (k.startsWith(`${deviceId}|`)) {
          try { const stop = bleState.subscriptions.get(k); stop && (await stop()); } catch {}
          bleState.subscriptions.delete(k);
        }
      }
      bleState.activeConnections.delete(deviceId);
      broadcast('ble:connectionChanged', { deviceId, state: 'disconnected' });
    } catch (e) {
      broadcast('ble:connectionChanged', { deviceId, state: 'disconnected' });
    }
  });

  ipcMain.handle('ble:read', async (_e, deviceId, serviceId, characteristicId) => {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      const value = await ch.readValue();
      const bytes = new Uint8Array(value.buffer);
      broadcast('ble:characteristicValue', { deviceId, serviceId, characteristicId, value: bytes, direction: 'read' });
    } catch (error) {
      console.error('[BLE] read() failed', { serviceId, characteristicId, error });
    }
  });

  ipcMain.handle('ble:write', async (_e, deviceId, serviceId, characteristicId, data) => {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      await ch.writeValue(new Uint8Array(data));
      broadcast('ble:characteristicValue', { deviceId, serviceId, characteristicId, value: new Uint8Array(data), direction: 'write' });
    } catch (error) {
      console.error('[BLE] write() failed', { serviceId, characteristicId, error });
    }
  });

  ipcMain.handle('ble:subscribe', async (_e, deviceId, serviceId, characteristicId) => {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      const listener = (ev) => {
        const target = ev.target;
        const dv = target?.value;
        const bytes = dv ? new Uint8Array(dv.buffer) : new Uint8Array();
        broadcast('ble:characteristicValue', { deviceId, serviceId, characteristicId, value: bytes, direction: 'notification' });
      };
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', listener);
      bleState.subscriptions.set(key(deviceId, serviceId, characteristicId), async () => {
        try { ch.removeEventListener('characteristicvaluechanged', listener); await ch.stopNotifications(); } catch {}
      });
      broadcast('ble:subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'started' });
    } catch (error) {
      console.error('[BLE] subscribe() failed', { serviceId, characteristicId, error });
    }
  });

  ipcMain.handle('ble:unsubscribe', async (_e, deviceId, serviceId, characteristicId) => {
    const k = key(deviceId, serviceId, characteristicId);
    const stop = bleState.subscriptions.get(k);
    if (stop) {
      try { await stop(); } catch {}
      bleState.subscriptions.delete(k);
    }
    broadcast('ble:subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'stopped' });
  });
}

function createWindow() {
  // Create the browser window
  let mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    backgroundColor: '#111111',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: false,
      preload: path.join(__dirname, 'preload.mjs')
    },
  });

  // Load the app
  if (isDev) {
    // In development, load from Vite dev server
    console.log('Loading from development server: http://localhost:5173');
    mainWindow.loadURL('http://localhost:5173');
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
    // Log renderer console and failures to help diagnose blank screen
    mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
      console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`);
    });
    mainWindow.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
      console.error('Renderer did-fail-load:', { errorCode, errorDescription, validatedURL });
    });
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
      console.error('Renderer process gone:', details);
    });
  } else {
    // In production, load the built files
    console.log('Loading from production build');
    mainWindow.loadFile(path.join(__dirname, 'build', 'client', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    // Dereference the window object
    mainWindow = null;
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
