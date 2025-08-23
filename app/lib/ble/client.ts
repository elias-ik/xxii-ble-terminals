import type { Device, Service, Connection } from '@/lib/ble-store';

export type ScanStatusEvent = { status: 'idle' | 'scanning' | 'completed' | 'failed'; deviceCount?: number; error?: string };
export type DeviceDiscoveredEvent = Device;
export type DeviceUpdatedEvent = Device;
export type ConnectionChangedEvent = { deviceId: string; state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'lost'; connection?: Connection };
export type SubscriptionChangedEvent = { deviceId: string; serviceId: string; characteristicId: string; action: 'started' | 'stopped' };
export type CharacteristicValueEvent = { deviceId: string; serviceId: string; characteristicId: string; value: string; direction: 'read' | 'write' | 'notification' };

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
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  read(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  write(deviceId: string, serviceId: string, characteristicId: string, data: string): Promise<void>;
  subscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  unsubscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
}

// Lazy import mock implementation for now; swap here later for real library
import { mockBLEClient } from './mock-client.ts';
let impl: BLEClient = mockBLEClient;
try {
  // Prefer real WebBluetooth client when available
  if (typeof window !== 'undefined') {
    const mod = await import('./webbluetooth-client.ts');
    impl = (mod as any).webBluetoothClient as BLEClient;
  }
} catch {}

export const bleClient: BLEClient = impl;


