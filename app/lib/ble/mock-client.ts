import type { BLEClient, BLEEventMap } from './client';
import type { Connection, ConsoleEntry } from '@/lib/ble-store';

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

// Minimal internal state for mock
const mockConnections: Record<string, Connection> = {};

export const mockBLEClient: BLEClient = {
  on: (e, h) => emitter.on(e, h as any),
  off: (e, h) => emitter.off(e, h as any),
  async scan() {
    emitter.emit('scanStatus', { status: 'scanning' });
    setTimeout(() => {
      const devices = [
        { id: 'device-001', name: 'BLE Terminal Alpha', address: '00:11:22:33:44:55', rssi: -45, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-002', name: 'Sensor Hub Beta', address: 'AA:BB:CC:DD:EE:FF', rssi: -67, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-003', name: 'Fitness Tracker Epsilon', address: 'FE:ED:CA:FE:BA:BE', rssi: -58, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-004', name: 'Env Sensor Zeta', address: '10:20:30:40:50:60', rssi: -62, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-005', name: 'Smart Thermostat Delta', address: 'DE:AD:BE:EF:CA:FE', rssi: -38, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-006', name: 'Beacon Eta', address: '10:20:30:40:50:61', rssi: -80, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-007', name: 'UART Bridge Gamma', address: '12:34:56:78:9A:BC', rssi: -52, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-008', name: 'Industrial Meter Theta', address: '10:20:30:40:50:62', rssi: -49, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const }
      ];
      devices.forEach((d, i) => setTimeout(() => emitter.emit('deviceDiscovered', d as any), i * 50));
      setTimeout(() => emitter.emit('scanStatus', { status: 'completed', deviceCount: devices.length }), devices.length * 50 + 100);
    }, 200);
  },
  async connect(deviceId: string) {
    emitter.emit('connectionChanged', { deviceId, state: 'connecting' });
    setTimeout(() => {
      const connection: Connection = {
        deviceId,
        connected: true,
        services: {
          // Device Information Service
          '180A': {
            uuid: '180A',
            name: 'Device Information',
            characteristics: {
              '2a29': { uuid: '2a29', name: 'Manufacturer Name', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
              '2a24': { uuid: '2a24', name: 'Model Number', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
              '2a26': { uuid: '2a26', name: 'Firmware Revision', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
              '2a27': { uuid: '2a27', name: 'Hardware Revision', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false }
            }
          },
          // Battery Service
          '180F': {
            uuid: '180F',
            name: 'Battery Service',
            characteristics: {
              '2a19': { uuid: '2a19', name: 'Battery Level', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
            }
          },
          // Heart Rate Service
          '180D': {
            uuid: '180D',
            name: 'Heart Rate',
            characteristics: {
              '2a37': { uuid: '2a37', name: 'Heart Rate Measurement', capabilities: { read: false, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
              '2a38': { uuid: '2a38', name: 'Body Sensor Location', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false }
            }
          },
          // Environmental Sensing
          '181A': {
            uuid: '181A',
            name: 'Environmental Sensing',
            characteristics: {
              '2a6e': { uuid: '2a6e', name: 'Temperature', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
              '2a6f': { uuid: '2a6f', name: 'Humidity', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
              '2a6d': { uuid: '2a6d', name: 'Pressure', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
            }
          },
          // UART/NUS-like custom service
          '6E400001-B5A3-F393-E0A9-E50E24DCCA9E': {
            uuid: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E',
            name: 'UART Service',
            characteristics: {
              'uart-tx': { uuid: 'uart-tx', name: 'UART TX', capabilities: { read: false, write: true, writeNoResp: true, notify: false, indicate: false }, subscribed: false },
              'uart-rx': { uuid: 'uart-rx', name: 'UART RX', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
            }
          },
          // Control service
          'custom-control': {
            uuid: 'custom-control',
            name: 'Control Service',
            characteristics: {
              'led-toggle': { uuid: 'led-toggle', name: 'LED Toggle', capabilities: { read: false, write: true, writeNoResp: true, notify: false, indicate: false }, subscribed: false },
              'status': { uuid: 'status', name: 'Status', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
            }
          },
          // Custom demo service
          'custom-service': {
            uuid: 'custom-service',
            name: 'Custom Service',
            characteristics: {
              'custom-char-1': { uuid: 'custom-char-1', name: 'Custom Characteristic 1', capabilities: { read: true, write: true, writeNoResp: true, notify: true, indicate: false }, subscribed: false },
              'custom-char-2': { uuid: 'custom-char-2', name: 'Custom Characteristic 2', capabilities: { read: false, write: true, writeNoResp: false, notify: false, indicate: true }, subscribed: false }
            }
          }
        },
        connectedAt: new Date()
      };
      mockConnections[deviceId] = connection;
      emitter.emit('connectionChanged', { deviceId, state: 'connected', connection });
    }, 400);
  },
  async disconnect(deviceId: string) {
    emitter.emit('connectionChanged', { deviceId, state: 'disconnecting' });
    setTimeout(() => {
      delete mockConnections[deviceId];
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    }, 200);
  },
  async read(deviceId, serviceId, characteristicId) {
    setTimeout(() => {
      // Return HEX-like byte strings to keep transport encoding-agnostic
      const sampleText = `Mock-${characteristicId}`;
      const bytes = new TextEncoder().encode(sampleText);
      const value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value, direction: 'read' });
    }, 200);
  },
  async write(deviceId, serviceId, characteristicId, data) {
    // echo write outbound event to UI through existing store path; here emit inbound only if subscribed
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    const isSubscribed = !!ch?.subscribed;
    if (isSubscribed) {
      setTimeout(() => {
        // Pass through exactly what was written, no decoding
        emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: String(data), direction: 'notification' });
      }, 200);
    }
  },
  async subscribe(deviceId, serviceId, characteristicId) {
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    if (ch) ch.subscribed = true;
    emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'started' });
    // periodic notifications
    const intervalId = setInterval(() => {
      // Emit encoded HEX-like payload; UI decides how to render
      const payload = `N-${characteristicId}-${Date.now()}`;
      const bytes = new TextEncoder().encode(payload);
      const value = Array.from(bytes).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value, direction: 'notification' });
    }, 5000);
    (window as any).__mockIntervals = (window as any).__mockIntervals || {};
    (window as any).__mockIntervals[`${deviceId}-${serviceId}-${characteristicId}`] = intervalId;
  },
  async unsubscribe(deviceId, serviceId, characteristicId) {
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    if (ch) ch.subscribed = false;
    emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'stopped' });
    const key = `${deviceId}-${serviceId}-${characteristicId}`;
    const map = (window as any).__mockIntervals || {};
    if (map[key]) { clearInterval(map[key]); delete map[key]; }
  }
};


