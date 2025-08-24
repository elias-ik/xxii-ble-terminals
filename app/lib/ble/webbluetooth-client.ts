import type { BLEClient, BLEEventMap } from './client';
import type { Connection, Service, Characteristic } from '@/lib/ble-store';

type Handler<K extends keyof BLEEventMap> = (payload: BLEEventMap[K]) => void;

class Emitter {
  private handlers: { [K in keyof BLEEventMap]?: Set<Handler<K>> } = {} as any;
  on<K extends keyof BLEEventMap>(event: K, handler: Handler<K>) {
    let set = this.handlers[event] as Set<Handler<K>> | undefined;
    if (!set) {
      set = new Set<Handler<K>>();
      (this.handlers as any)[event] = set as any;
    }
    set.add(handler as any);
  }
  off<K extends keyof BLEEventMap>(event: K, handler: Handler<K>) {
    this.handlers[event]?.delete(handler as any);
  }
  emit<K extends keyof BLEEventMap>(event: K, payload: BLEEventMap[K]) {
    this.handlers[event]?.forEach((h) => (h as any)(payload));
  }
}

const emitter = new Emitter();
const log = {
  info: (...args: any[]) => console.log('[WebBLE]', ...args),
  warn: (...args: any[]) => console.warn('[WebBLE]', ...args),
  error: (...args: any[]) => console.error('[WebBLE]', ...args),
};

// Simple in-memory subscription map for notifications
const subscriptions = new Map<string, () => void>();
// Cache of discovered devices during scan to avoid re-requesting on connect
const discoveredDevices = new Map<string, any>();

// Lazy-load the webbluetooth Bluetooth constructor once
let BluetoothCtor: any | null = null;
async function getBluetoothCtor() {
  if (!BluetoothCtor) {
    const mod = await import('webbluetooth');
    BluetoothCtor = (mod as any).Bluetooth;
  }
  return BluetoothCtor;
}

// Active connections cache: keep native server/services/characteristics to reuse across calls
const activeConnections = new Map<string, {
  device: any;
  server: any;
  services: Map<string, any>;
  characteristics: Map<string, any>;
  uiServices?: Record<string, Service>;
}>();

async function listRootServices(server: any): Promise<any[]> {
  // Union of primary services and all services (if supported), dedup by uuid
  const byUuid = new Map<string, any>();
  const addServicesToMap = (list: any) => {
    if (Array.isArray(list)) {
      for (const s of list) {
        if (s?.uuid && !byUuid.has(s.uuid)) byUuid.set(s.uuid, s);
      }
    }
  };
  try {
    if (typeof server.getPrimaryServices === 'function') {
      const prim = await server.getPrimaryServices();
      addServicesToMap(prim);
    }
  } catch {}
  try {
    if (typeof server.getServices === 'function') {
      const all = await server.getServices();
      addServicesToMap(all);
    }
  } catch {}
  try {
    if (typeof server.getIncludedServices === 'function') {
      const all = await server.getIncludedServices();
      addServicesToMap(all);
    }
  } catch {}
  return Array.from(byUuid.values());
}

async function getNativeService(deviceId: string, serviceId: string) {
  const meta = activeConnections.get(deviceId);
  if (!meta) throw new Error('Not connected');
  if (meta.services.has(serviceId)) return meta.services.get(serviceId);
  const svc = await meta.server.getPrimaryService(serviceId);
  meta.services.set(serviceId, svc);
  return svc;
}

async function getNativeCharacteristic(deviceId: string, serviceId: string, characteristicId: string) {
  const meta = activeConnections.get(deviceId);
  if (!meta) throw new Error('Not connected');
  const keyId = key(deviceId, serviceId, characteristicId);
  if (meta.characteristics.has(keyId)) return meta.characteristics.get(keyId);
  const svc = await getNativeService(deviceId, serviceId);
  const ch = await svc.getCharacteristic(characteristicId);
  meta.characteristics.set(keyId, ch);
  return ch;
}

function key(deviceId: string, serviceId: string, characteristicId: string) {
  return `${deviceId}|${serviceId}|${characteristicId}`;
}

export const webBluetoothClient: BLEClient = {
  on: (e, h) => emitter.on(e, h as any),
  off: (e, h) => emitter.off(e, h as any),
  async scan() {
    try {
      emitter.emit('scanStatus', { status: 'scanning' });
      const Bluetooth = await getBluetoothCtor();

      const seen = new Set<string>();
      let lastFoundAt = Date.now();
      let keepGoing = true;
      const idleLimitMs = 10000;
      const maxTotalMs = 60000;
      const startedAt = Date.now();

      const runOnce = async () => {
        const bt = new Bluetooth({
          allowAllDevices: true,
          scanTime: 2, // short burst; we loop until idle window
          deviceFound: (device: any, selectFn: () => void) => {
            const id = device?.id || device?.address || device?.name || String(Math.random());
            if (!seen.has(id)) {
              const rawName = device?.name || 'Generic BLE Device';
              const unsupportedRegex = /Unknown or Unsupported Device (.*)/;
              const deviceName = unsupportedRegex.test(device?.name ?? '') ? 'Unsupported' : rawName;
              // Cache the full device object for later connect()
              discoveredDevices.set(id, device);
              seen.add(id);
              lastFoundAt = Date.now();
              // Suppress scan logs to reduce noise
              emitter.emit('deviceDiscovered', {
                id,
                name: deviceName,
                address: id,
                rssi: device?.rssi || -60,
                connected: false,
                lastSeen: new Date(),
                previouslyConnected: false,
                connectionStatus: 'disconnected'
              } as any);
            }
            // Immediately resolve this requestDevice burst so the loop can evaluate idle time
            try { selectFn(); } catch {}
            return true;
          }
        } as any);
        try {
          // Will scan and invoke deviceFound; request with no optionalServices to avoid service access limits
          await (bt as any).requestDevice({ acceptAllDevices: true, optionalServices: [] });
        } catch (e) {
          // expected if no selection occurs; ignore
        }
      };

      while (keepGoing) {
        await runOnce();
        const idleMs = Date.now() - lastFoundAt;
        const totalMs = Date.now() - startedAt;
        if (idleMs >= idleLimitMs || totalMs >= maxTotalMs) {
          keepGoing = false;
        }
      }

      emitter.emit('scanStatus', { status: 'completed', deviceCount: seen.size });
    } catch (error: any) {
      log.error('scan() failed', error);
      emitter.emit('scanStatus', { status: 'failed', error: String(error?.message || error) });
    }
  },
  async connect(deviceId: string) {
    try {
      emitter.emit('connectionChanged', { deviceId, state: 'connecting' });
      // If already connected, re-emit connection with cached UI services
      const existing = activeConnections.get(deviceId);
      if (existing?.server?.connected) {
        const connection: Connection = {
          deviceId,
          connected: true,
          services: existing.uiServices || {},
          connectedAt: new Date()
        } as any;
        emitter.emit('connectionChanged', { deviceId, state: 'connected', connection });
        return;
      }

      // Use cached device from scan to avoid re-requesting
      const device = discoveredDevices.get(deviceId);
      if (!device) {
        log.warn('connect(): device not found in cache; ensure scan ran before connect', { deviceId });
        throw new Error('Device not found in cache');
      }
      log.info('connect(): using cached device', { id: device.id, name: device.name });
      const server = await device.gatt!.connect();
      log.info('connect(): gatt connected');
      // Discover primary and included services (BFS), then enumerate characteristics for each
      const svcMap: Record<string, Service> = {};
      const nativeServices = new Map<string, any>();
      const nativeChars = new Map<string, any>();

      const seenServiceUuids = new Set<string>();
      const queue: any[] = await listRootServices(server);
      log.info('connect(): discovered root services (union primary+all)', queue?.length);
      if (!queue || queue.length === 0) {
        log.warn('connect(): no services discovered. Ensure device exposes services and optionalServices includes needed UUIDs when requesting permissions.');
      }
      try {
        log.info('connect(): root service UUIDs', Array.isArray(queue) ? queue.map((s: any) => s?.uuid) : []);
      } catch {}

      while (queue.length > 0) {
        const svc = queue.shift();
        if (!svc || seenServiceUuids.has(svc.uuid)) continue;
        seenServiceUuids.add(svc.uuid);
        nativeServices.set(svc.uuid, svc);

        // Queue included services, if any
        try {
          const included = await svc.getIncludedServices();
          if (Array.isArray(included)) {
            for (const inc of included) {
              if (inc && !seenServiceUuids.has(inc.uuid)) queue.push(inc);
            }
            try {
              log.info('connect(): included services', { parent: svc.uuid, uuids: included.map((i: any) => i?.uuid) });
            } catch {}
          }
        } catch (e) {
          // Some stacks may not support included services; ignore
        }

        // Enumerate characteristics for this service
        const chMap: Record<string, Characteristic> = {};
        try {
          const chars = await svc.getCharacteristics();
          for (const ch of chars) {
            nativeChars.set(key(device.id || deviceId, svc.uuid, ch.uuid), ch);
            const props = ch.properties || {};
            chMap[ch.uuid] = {
              uuid: ch.uuid,
              name: ch.uuid,
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
          try {
            log.info('connect(): characteristics for service', { service: svc.uuid, uuids: Object.keys(chMap) });
          } catch {}
        } catch (e) {
          // If characteristics enumeration fails for a service, continue with others
        }

        svcMap[svc.uuid] = { uuid: svc.uuid, name: svc.uuid, characteristics: chMap } as Service;
      }

      activeConnections.set(device.id || deviceId, {
        device,
        server,
        services: nativeServices,
        characteristics: nativeChars,
        uiServices: svcMap,
      });
      try {
        log.info('connect(): cache summary', {
          services: Object.keys(svcMap).length,
          characteristics: Array.from(nativeChars.keys()).length,
        });
      } catch {}

      const connection: Connection = {
        deviceId: device.id || deviceId,
        connected: true,
        services: svcMap,
        connectedAt: new Date()
      };
      emitter.emit('connectionChanged', { deviceId: device.id || deviceId, state: 'connected', connection });
    } catch (error: any) {
      log.error('connect() failed', error);
      emitter.emit('connectionChanged', { deviceId, state: 'lost' });
    }
  },
  async disconnect(deviceId: string) {
    emitter.emit('connectionChanged', { deviceId, state: 'disconnecting' });
    try {
      const meta = activeConnections.get(deviceId);
      if (meta?.server?.connected) {
        try { meta.server.disconnect(); } catch {}
      }
      // Clear cached subscriptions for this device
      for (const k of Array.from(subscriptions.keys())) {
        if (k.startsWith(`${deviceId}|`)) {
          try { const stop = subscriptions.get(k); stop && (await stop()); } catch {}
          subscriptions.delete(k);
        }
      }
      activeConnections.delete(deviceId);
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    } catch (e) {
      log.warn('disconnect() swallow error', e);
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    }
  },
  async read(deviceId, serviceId, characteristicId) {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      const value = await ch.readValue();
      const bytes = new Uint8Array(value.buffer);
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: bytes, direction: 'read' });
    } catch (error: any) {
      log.error('read() failed', { serviceId, characteristicId, error });
    }
  },
  async write(deviceId, serviceId, characteristicId, data: Uint8Array) {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      await ch.writeValue(data);
      const asText = new TextDecoder().decode(data);
      log.info('write()', { serviceId, characteristicId, data: asText });
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: data, direction: 'write' });
    } catch (error: any) {
      log.error('write() failed', { serviceId, characteristicId, error });
    }
  },
  async subscribe(deviceId, serviceId, characteristicId) {
    try {
      const ch = await getNativeCharacteristic(deviceId, serviceId, characteristicId);
      const listener = (ev: Event) => {
        const target = ev.target as any;
        const dv = target?.value as DataView | undefined;
        const bytes = dv ? new Uint8Array(dv.buffer) : new Uint8Array();
        const asText = new TextDecoder().decode(bytes);
        log.info('subscribe()', { serviceId, characteristicId, value: asText });
        emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: bytes, direction: 'notification' });
      };
      await ch.startNotifications();
      ch.addEventListener('characteristicvaluechanged', listener);
      subscriptions.set(key(deviceId, serviceId, characteristicId), async () => {
        try {
          ch.removeEventListener('characteristicvaluechanged', listener);
          await ch.stopNotifications();
        } catch (e) { log.warn('unsubscribe() inner stop failed', e); }
      });
      emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'started' });
    } catch (error: any) {
      log.error('subscribe() failed', { serviceId, characteristicId, error });
    }
  },
  async unsubscribe(deviceId, serviceId, characteristicId) {
    const k = key(deviceId, serviceId, characteristicId);
    const stop = subscriptions.get(k);
    if (stop) {
      try { await stop(); } catch (e) { log.warn('unsubscribe() stop failed', e); }
      subscriptions.delete(k);
    }
    emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'stopped' });
  }
};


