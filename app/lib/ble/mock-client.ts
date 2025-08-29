import type { BLEClient, BLEEventMap } from './index';
import type { Connection } from '@/lib/ble-store';

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

// Mock data generators for realistic characteristic values
const mockDataGenerators = {
  // Device Information Service (180A)
  '2a29': () => new TextEncoder().encode('XXII Technologies'), // Manufacturer Name
  '2a24': () => new TextEncoder().encode('BLE-Terminal-v1.2'), // Model Number
  '2a26': () => new TextEncoder().encode('2.1.4'), // Firmware Revision
  '2a27': () => new TextEncoder().encode('1.0.0'), // Hardware Revision

  // Battery Service (180F)
  '2a19': () => {
    // Battery level as percentage (0-100)
    const batteryLevel = Math.floor(Math.random() * 100) + 1;
    return new TextEncoder().encode(`${batteryLevel}%`);
  },

  // Heart Rate Service (180D)
  '2a37': () => {
    // Heart rate measurement as readable text
    const heartRate = Math.floor(Math.random() * 40) + 60; // 60-100 BPM
    return new TextEncoder().encode(`${heartRate}bpm`);
  },
  '2a38': () => {
    // Body sensor location as readable text
    const locations = ['Chest', 'Wrist', 'Finger'];
    const location = locations[Math.floor(Math.random() * locations.length)];
    return new TextEncoder().encode(location);
  },

  // Environmental Sensing Service (181A)
  '2a6e': () => {
    // Temperature in Celsius as readable text
    const tempC = (20 + (Math.random() * 15) - 5).toFixed(1); // -5 to 35degC
    return new TextEncoder().encode(`${tempC}degC`);
  },
  '2a6f': () => {
    // Humidity percentage as readable text
    const humidity = Math.floor(Math.random() * 60) + 20; // 20-80%
    return new TextEncoder().encode(`${humidity}%`);
  },
  '2a6d': () => {
    // Pressure in hPa as readable text
    const pressureHPa = Math.round((101325 + (Math.random() * 5000) - 2500) / 100); // Convert Pa to hPa
    return new TextEncoder().encode(`${pressureHPa}hPa`);
  },

  // UART Service
  'uart-rx': () => {
    // Echo back with "Echo" prefix
    return new TextEncoder().encode('Echo: Ready for data');
  },

  // Custom Service
  'custom-char-1': () => {
    const timestamp = new Date().toISOString();
    return new TextEncoder().encode(`Custom data: ${timestamp}`);
  },
  'status': () => {
    const statuses = ['OK', 'WARNING', 'ERROR', 'BUSY'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    return new TextEncoder().encode(status);
  }
};

// Generate realistic notification data
const generateNotificationData = (characteristicId: string): Uint8Array => {
  switch (characteristicId) {
    case '2a19': // Battery level
      const batteryLevel = Math.floor(Math.random() * 100) + 1;
      return new TextEncoder().encode(`${batteryLevel}%`);
    
    case '2a37': // Heart rate
      const heartRate = Math.floor(Math.random() * 40) + 60;
      return new TextEncoder().encode(`${heartRate}bpm`);
    
    case '2a6e': // Temperature
      const tempC = (20 + (Math.random() * 15) - 5).toFixed(1);
      return new TextEncoder().encode(`${tempC}degC`);
    
    case '2a6f': // Humidity
      const humidity = Math.floor(Math.random() * 60) + 20;
      return new TextEncoder().encode(`${humidity}%`);
    
    case '2a6d': // Pressure
      const pressureHPa = Math.round((101325 + (Math.random() * 5000) - 2500) / 100);
      return new TextEncoder().encode(`${pressureHPa}hPa`);
    
    case 'uart-rx':
      const timestamp = new Date().toLocaleTimeString();
      return new TextEncoder().encode(`Echo: [${timestamp}] Data received`);
    
    case 'status':
      const statuses = ['OK', 'WARNING', 'ERROR', 'BUSY'];
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      return new TextEncoder().encode(status);
    
    case 'custom-char-1':
      const customData = `Notification: ${Date.now()}`;
      return new TextEncoder().encode(customData);
    
    default:
      return new TextEncoder().encode(`Notification-${characteristicId}-${Date.now()}`);
  }
};

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
        { id: 'device-008', name: 'Industrial Meter Theta', address: '10:20:30:40:50:62', rssi: -49, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-009', name: 'Smart Watch Omega', address: '11:22:33:44:55:66', rssi: -42, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-010', name: 'Blood Pressure Monitor', address: '22:33:44:55:66:77', rssi: -71, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-011', name: 'Glucose Meter Sigma', address: '33:44:55:66:77:88', rssi: -55, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-012', name: 'Smart Lock Lambda', address: '44:55:66:77:88:99', rssi: -63, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-013', name: 'Security Camera Pi', address: '55:66:77:88:99:AA', rssi: -48, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-014', name: 'Smart Speaker Rho', address: '66:77:88:99:AA:BB', rssi: -35, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-015', name: 'IoT Gateway Tau', address: '77:88:99:AA:BB:CC', rssi: -59, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-016', name: 'Smart Bulb Phi', address: '88:99:AA:BB:CC:DD', rssi: -66, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-017', name: 'Motion Sensor Chi', address: '99:AA:BB:CC:DD:EE', rssi: -73, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-018', name: 'Smart Plug Psi', address: 'AA:BB:CC:DD:EE:FF', rssi: -41, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-019', name: 'Weather Station Xi', address: 'BB:CC:DD:EE:FF:00', rssi: -69, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-020', name: 'Smart Scale Omicron', address: 'CC:DD:EE:FF:00:11', rssi: -51, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-021', name: 'Bluetooth Headphones', address: 'DD:EE:FF:00:11:22', rssi: -44, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-022', name: 'Wireless Mouse', address: 'EE:FF:00:11:22:33', rssi: -37, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-023', name: 'Keyboard Pro', address: 'FF:00:11:22:33:44', rssi: -33, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-024', name: 'Game Controller', address: '00:11:22:33:44:55', rssi: -46, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const },
        { id: 'device-025', name: 'Smart Mirror', address: '11:22:33:44:55:66', rssi: -68, connected: false, lastSeen: new Date(), previouslyConnected: false, connectionStatus: 'disconnected' as const }
      ];
      
      // Spread device discoveries over 30 seconds (30000ms)
      const totalScanTime = 30000; // 30 seconds
      const intervalBetweenDevices = totalScanTime / devices.length;
      
      devices.forEach((d, i) => {
        const delay = i * intervalBetweenDevices;
        setTimeout(() => emitter.emit('deviceDiscovered', d as any), delay);
      });
      
      // Complete scan after all devices are discovered
      setTimeout(() => emitter.emit('scanStatus', { status: 'completed', deviceCount: devices.length }), totalScanTime + 1000);
    }, 200);
  },
  async connect(deviceId: string) {
    emitter.emit('connectionChanged', { deviceId, state: 'connecting' });
    setTimeout(() => {
      const connection: Connection = {
        deviceId,
        connected: true,
        services: {
          '180A': { uuid: '180A', name: 'Device Information', characteristics: {
            '2a29': { uuid: '2a29', name: 'Manufacturer Name', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
            '2a24': { uuid: '2a24', name: 'Model Number', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
            '2a26': { uuid: '2a26', name: 'Firmware Revision', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false },
            '2a27': { uuid: '2a27', name: 'Hardware Revision', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false }
          } },
          '180F': { uuid: '180F', name: 'Battery Service', characteristics: {
            '2a19': { uuid: '2a19', name: 'Battery Level', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
          } },
          '180D': { uuid: '180D', name: 'Heart Rate', characteristics: {
            '2a37': { uuid: '2a37', name: 'Heart Rate Measurement', capabilities: { read: false, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
            '2a38': { uuid: '2a38', name: 'Body Sensor Location', capabilities: { read: true, write: false, writeNoResp: false, notify: false, indicate: false }, subscribed: false }
          } },
          '181A': { uuid: '181A', name: 'Environmental Sensing', characteristics: {
            '2a6e': { uuid: '2a6e', name: 'Temperature', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
            '2a6f': { uuid: '2a6f', name: 'Humidity', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false },
            '2a6d': { uuid: '2a6d', name: 'Pressure', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
          } },
          '6E400001-B5A3-F393-E0A9-E50E24DCCA9E': { uuid: '6E400001-B5A3-F393-E0A9-E50E24DCCA9E', name: 'UART Service', characteristics: {
            'uart-tx': { uuid: 'uart-tx', name: 'UART TX', capabilities: { read: false, write: true, writeNoResp: true, notify: false, indicate: false }, subscribed: false },
            'uart-rx': { uuid: 'uart-rx', name: 'UART RX', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
          } },
          'custom-control': { uuid: 'custom-control', name: 'Control Service', characteristics: {
            'led-toggle': { uuid: 'led-toggle', name: 'LED Toggle', capabilities: { read: false, write: true, writeNoResp: true, notify: false, indicate: false }, subscribed: false },
            'status': { uuid: 'status', name: 'Status', capabilities: { read: true, write: false, writeNoResp: false, notify: true, indicate: false }, subscribed: false }
          } },
          'custom-service': { uuid: 'custom-service', name: 'Custom Service', characteristics: {
            'custom-char-1': { uuid: 'custom-char-1', name: 'Custom Characteristic 1', capabilities: { read: true, write: true, writeNoResp: true, notify: true, indicate: false }, subscribed: false },
            'custom-char-2': { uuid: 'custom-char-2', name: 'Custom Characteristic 2', capabilities: { read: false, write: true, writeNoResp: false, notify: false, indicate: true }, subscribed: false }
          } }
        },
        connectedAt: new Date()
      };
      mockConnections[deviceId] = connection;
      emitter.emit('connectionChanged', { deviceId, state: 'connected', connection });
      
      // Set up periodic connection health check for mock client
      const healthCheckInterval = setInterval(() => {
        // Simulate random disconnections (very low probability for testing)
        if (Math.random() < 0.001) { // 0.1% chance per check
          console.log('[Mock] Simulating unexpected disconnection for device:', deviceId);
          clearInterval(healthCheckInterval);
          delete mockConnections[deviceId];
          emitter.emit('connectionChanged', { deviceId, state: 'lost' });
        }
      }, 10000); // Check every 10 seconds
      
      // Store the interval for cleanup
      (window as any).__mockHealthChecks = (window as any).__mockHealthChecks || {};
      (window as any).__mockHealthChecks[deviceId] = healthCheckInterval;
    }, 400);
  },
  async disconnect(deviceId: string) {
    emitter.emit('connectionChanged', { deviceId, state: 'disconnecting' });
    setTimeout(() => {
      // Clear health check interval
      const healthChecks = (window as any).__mockHealthChecks || {};
      if (healthChecks[deviceId]) {
        clearInterval(healthChecks[deviceId]);
        delete healthChecks[deviceId];
      }
      delete mockConnections[deviceId];
      emitter.emit('connectionChanged', { deviceId, state: 'disconnected' });
    }, 200);
  },
  async read(deviceId, serviceId, characteristicId) {
    setTimeout(() => {
      // Use realistic data generators for known characteristics
      const generator = mockDataGenerators[characteristicId as keyof typeof mockDataGenerators];
      const value = generator ? generator() : new TextEncoder().encode(`Mock-${characteristicId}`);
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value, direction: 'read' });
    }, 200);
  },
  async write(deviceId, serviceId, characteristicId, data: Uint8Array) {
    // echo write outbound event to UI through existing store path; here emit inbound only if subscribed
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    const isSubscribed = !!ch?.subscribed;
    if (isSubscribed) {
      setTimeout(() => {
        // For UART RX, echo back with "Echo" prefix
        if (characteristicId === 'uart-rx') {
          const inputText = new TextDecoder().decode(data);
          const echoResponse = `Echo: ${inputText}`;
          const value = new TextEncoder().encode(echoResponse);
          emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value, direction: 'notification' });
        } else {
          // Pass through exactly what was written for other characteristics
          emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value: data, direction: 'notification' });
        }
      }, 200);
    }
  },
  async subscribe(deviceId, serviceId, characteristicId) {
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    if (ch) ch.subscribed = true;
    
    // Emit subscription change event first
    emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'started' });
    
    // Set up periodic notifications with realistic data
    const intervalId = setInterval(() => {
      const value = generateNotificationData(characteristicId);
      emitter.emit('characteristicValue', { deviceId, serviceId, characteristicId, value, direction: 'notification' });
    }, 5000);
    
    // Store the interval for cleanup
    (window as any).__mockIntervals = (window as any).__mockIntervals || {};
    (window as any).__mockIntervals[`${deviceId}-${serviceId}-${characteristicId}`] = intervalId;
  },
  async unsubscribe(deviceId, serviceId, characteristicId) {
    const svc = mockConnections[deviceId]?.services?.[serviceId];
    const ch = svc?.characteristics?.[characteristicId];
    if (ch) ch.subscribed = false;
    
    // Clear the interval first
    const key = `${deviceId}-${serviceId}-${characteristicId}`;
    const map = (window as any).__mockIntervals || {};
    if (map[key]) { 
      clearInterval(map[key]); 
      delete map[key]; 
    }
    
    // Emit subscription change event after cleanup
    emitter.emit('subscriptionChanged', { deviceId, serviceId, characteristicId, action: 'stopped' });
  }
};


