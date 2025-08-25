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
  connect(deviceId: string): Promise<void>;
  disconnect(deviceId: string): Promise<void>;
  read(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  write(deviceId: string, serviceId: string, characteristicId: string, data: Uint8Array): Promise<void>;
  subscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
  unsubscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<void>;
}

// Storage-style switching: in Electron (main/renderer), prefer real webbluetooth; in plain web, use mock.
import { mockBLEClient } from './mock-client.ts';
import { ipcBLEClient } from './ipc-client';
let impl: BLEClient = mockBLEClient;
try {
  // If running in Electron renderer with preload exposing bleAPI, use IPC client
  if (typeof window !== 'undefined' && (window as any).bleAPI) {
    impl = ipcBLEClient;
  }
  console.log('using ipc client');
} catch {
  console.log('using mock client');
}

export const bleClient: BLEClient = impl;


