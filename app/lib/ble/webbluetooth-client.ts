import type { BLEClient, BLEEventMap } from './client';
import type { Connection, Service, Characteristic } from '@/lib/ble-store';

type Handler<K extends keyof BLEEventMap> = (payload: BLEEventMap[K]) => void;

class Emitter {
  private handlers: { [K in keyof BLEEventMap]?: Set<Handler<K>> } = {} as any;
  on<K extends keyof BLEEventMap>(event: K, handler: Handler<K>) {
    const set = (this.handlers[event] ??= new Set());
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

function key(deviceId: string, serviceId: string, characteristicId: string) {
  return `${deviceId}|${serviceId}|${characteristicId}`;
}

export const webBluetoothClient: BLEClient = {
  on: (e, h) => emitter.on(e, h as any),
  off: (e, h) => emitter.off(e, h as any),
  async scan() {
    try {
      emitter.emit('scanStatus', { status: 'scanning' });
      const { Bluetooth } = await import('webbluetooth');

      const seen = new Set<string>();
      let lastFoundAt = Date.now();
      let keepGoing = true;
      const idleLimitMs = 5000;
      const maxTotalMs = 60000;
      const startedAt = Date.now();

      const runOnce = async () => {
        const bt = new Bluetooth({
          allowAllDevices: true,
          scanTime: 6, // slight buffer above idle window
          deviceFound: (device: any) => {
            const id = device?.id || device?.address || device?.name || String(Math.random());
            if (!seen.has(id)) {
              seen.add(id);
              lastFoundAt = Date.now();
              log.info('scan(): deviceFound', { id, name: device?.name });
              emitter.emit('deviceDiscovered', {
                id,
                name: device?.name || 'BLE Device',
                address: id,
                rssi: -60,
                connected: false,
                lastSeen: new Date(),
                previouslyConnected: false,
                connectionStatus: 'disconnected'
              } as any);
            }
            return false; // never auto-select; keep scanning
          }
        } as any);
        try {
          // Will scan and invoke deviceFound; we ignore the returned device
          await (bt as any).requestDevice({ acceptAllDevices: true, optionalServices: ['device_information'] });
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
      const { bluetooth } = await import('webbluetooth');
      // Ask for any device if id is not resolvable
      log.info('connect(): requestDevice...', { deviceId });
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: ['generic_access','device_information'] });
      log.info('connect(): got device', { id: device.id, name: device.name });
      const server = await device.gatt!.connect();
      log.info('connect(): gatt connected');
      const services = await server.getPrimaryServices();
      log.info('connect(): discovered services', services?.length);

      const svcMap: Record<string, Service> = {};
      for (const svc of services) {
        const chars = await svc.getCharacteristics();
        const chMap: Record<string, Characteristic> = {};
        for (const ch of chars) {
          const props = ch.properties;
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
        svcMap[svc.uuid] = { uuid: svc.uuid, name: svc.uuid, characteristics: chMap } as Service;
      }

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
      // There is no direct global disconnect via webbluetooth API reference saved here; UI should track server
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    } catch (e) {
      log.warn('disconnect() swallow error', e);
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    }
  },
  async read(deviceId, serviceId, characteristicId) {
    try {
      const { bluetooth } = await import('webbluetooth');
      log.info('read(): requestDevice...', { serviceId, characteristicId });
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [serviceId] });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(serviceId);
      const ch = await service.getCharacteristic(characteristicId);
      const value = await ch.readValue();
      const txt = new TextDecoder().decode(value.buffer);
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: txt, direction: 'read' });
    } catch (error: any) {
      log.error('read() failed', { serviceId, characteristicId, error });
    }
  },
  async write(deviceId, serviceId, characteristicId, data) {
    try {
      const { bluetooth } = await import('webbluetooth');
      log.info('write(): requestDevice...', { serviceId, characteristicId });
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [serviceId] });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(serviceId);
      const ch = await service.getCharacteristic(characteristicId);
      const enc = new TextEncoder().encode(data);
      await ch.writeValue(enc);
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: data, direction: 'write' });
    } catch (error: any) {
      log.error('write() failed', { serviceId, characteristicId, error });
    }
  },
  async subscribe(deviceId, serviceId, characteristicId) {
    try {
      const { bluetooth } = await import('webbluetooth');
      log.info('subscribe(): requestDevice...', { serviceId, characteristicId });
      const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [serviceId] });
      const server = await device.gatt!.connect();
      const service = await server.getPrimaryService(serviceId);
      const ch = await service.getCharacteristic(characteristicId);
      const listener = (ev: Event) => {
        const target = ev.target as BluetoothRemoteGATTCharacteristic;
        const val = target.value ? new TextDecoder().decode(target.value.buffer) : '';
        emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: val, direction: 'notification' });
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


