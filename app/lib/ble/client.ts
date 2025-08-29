import type { Device, Service, Connection } from '@/lib/ble-store';

export type ScanStatusEvent = { status: 'idle' | 'scanning' | 'completed' | 'failed'; deviceCount?: number; error?: string };
export type DeviceDiscoveredEvent = Device;
export type DeviceUpdatedEvent = Device;
export type ConnectionChangedEvent = { deviceId: string; state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'lost'; connection?: Connection };
export type SubscriptionChangedEvent = { deviceId: string; serviceId: string; characteristicId: string; action: 'started' | 'stopped' };
export type CharacteristicValueEvent = { deviceId: string; serviceId: string; characteristicId: string; value: Uint8Array; direction: 'read' | 'write' | 'notification' };

export type BLEEventMap = {
  scanStatus: ScanStatusEvent;
  deviceDiscovered: DeviceDiscoveredEvent;
  deviceUpdated: DeviceUpdatedEvent;
  connectionChanged: ConnectionChangedEvent;
  subscriptionChanged: SubscriptionChangedEvent;
  characteristicValue: CharacteristicValueEvent;
};

export interface BLEClient {
  on<K extends keyof BLEEventMap>(event: K, handler: (payload: BLEEventMap[K]) => void): void;
  off<K extends keyof BLEEventMap>(event: K, handler: (payload: BLEEventMap[K]) => void): void;

  scan(): Promise<void>;
  stopScan(): Promise<void>;
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  read(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  write(deviceId: string, serviceId: string, characteristicId: string, data: Uint8Array): Promise<void>;
  subscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  unsubscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
}

// Lazy import mock implementation for now; swap here later for real library
import { mockBLEClient } from './mock-client.ts';
let impl: BLEClient = mockBLEClient;
let clientType = 'mock';

console.log('[BLE Client] Starting client selection...');

try {
  // Prefer real WebBluetooth client when available
  if (typeof window !== 'undefined') {
    console.log('[BLE Client] Window detected, attempting to load Web Bluetooth client...');
    const mod = await import('./webbluetooth-client.ts');
    impl = (mod as { webBluetoothClient: BLEClient }).webBluetoothClient;
    clientType = 'webbluetooth';
    console.log('[BLE Client] Successfully loaded Web Bluetooth client');
  } else {
    console.log('[BLE Client] No window detected, using mock client');
  }
} catch (error) {
  console.log('[BLE Client] Failed to load Web Bluetooth client, falling back to mock:', error);
  clientType = 'mock';
}

console.log('[BLE Client] Final client selection:', {
  clientType,
  isRenderer: typeof window !== 'undefined',
  isNode: typeof process !== 'undefined' && process.versions && process.versions.node,
  electron: typeof process !== 'undefined' && process.versions && process.versions.electron ? 'Yes' : 'No'
});

export const bleClient: BLEClient = impl;


