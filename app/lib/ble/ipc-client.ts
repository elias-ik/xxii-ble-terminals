import type { BLEClient, BLEEventMap } from './index';

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

function bindOnceToWindowAPI() {
  const w = (typeof window !== 'undefined' ? (window as any) : undefined);
  if (!w || !w.bleAPI) return;
  if (w.__ipcBleBound) return;
  w.__ipcBleBound = true;

  const ble = w.bleAPI;

  // Map underlying bridge listeners to our emitter
  ble.onScanStatus((evt: any) => emitter.emit('scanStatus', evt));
  // Singular discovery from bridge
  if (ble.onDeviceDiscovered) {
    ble.onDeviceDiscovered((evt: any) => emitter.emit('deviceDiscovered', evt.device ?? evt));
  }
  // Batched discovery from bridge
  if (ble.onDevicesDiscovered) {
    ble.onDevicesDiscovered((evt: any) => {
      const list: any[] = evt.devices ?? evt;
      if (Array.isArray(list)) {
        for (const d of list) {
          emitter.emit('deviceDiscovered', d);
        }
      }
    });
  }
  if (ble.onDeviceUpdated) {
    ble.onDeviceUpdated((evt: any) => emitter.emit('deviceUpdated', evt.device ?? evt));
  }
  ble.onConnectionChanged((evt: any) => emitter.emit('connectionChanged', { deviceId: evt.deviceId, state: (evt.status || evt.state), connection: evt.connection }));
  ble.onCharacteristicValue((evt: any) => emitter.emit('characteristicValue', { ...evt, direction: evt.direction || 'notification' }));
  ble.onSubscriptionChanged((evt: any) => emitter.emit('subscriptionChanged', evt));
}

bindOnceToWindowAPI();

export const ipcBLEClient: BLEClient = {
  on: (e, h) => emitter.on(e as any, h as any),
  off: (e, h) => emitter.off(e as any, h as any),
  async scan() {
    const ble = (window as any).bleAPI;
    await ble.scan();
  },
  async stopScan() {
    const ble = (window as any).bleAPI;
    if (ble.stopScan) {
      await ble.stopScan();
    }
  },
  async connect(deviceId: string) {
    const ble = (window as any).bleAPI;
    await ble.connect(deviceId);
  },
  async disconnect(deviceId: string) {
    const ble = (window as any).bleAPI;
    await ble.disconnect(deviceId);
  },
  async read(deviceId, serviceId, characteristicId) {
    const ble = (window as any).bleAPI;
    await ble.read(deviceId, serviceId, characteristicId);
  },
  async write(deviceId, serviceId, characteristicId, data) {
    const ble = (window as any).bleAPI;
    await ble.write(deviceId, serviceId, characteristicId, data);
  },
  async subscribe(deviceId, serviceId, characteristicId) {
    const ble = (window as any).bleAPI;
    await ble.subscribe(deviceId, serviceId, characteristicId, () => {});
  },
  async unsubscribe(deviceId, serviceId, characteristicId) {
    const ble = (window as any).bleAPI;
    await ble.unsubscribe(deviceId, serviceId, characteristicId);
  }
};


