// TypeScript declarations for Electron APIs exposed to renderer process

export interface Device {
  id: string;
  name: string;
  address: string;
  rssi: number;
  connected: boolean;
  lastSeen: Date;
  advertisingData?: Record<string, any>;
  previouslyConnected: boolean;
  connectionLostAt?: Date;
  connectionStatus: 'disconnected' | 'connected' | 'lost' | 'connecting' | 'disconnecting';
  connectedAt?: Date;
}

export interface CharacteristicCapabilities {
  read: boolean;
  write: boolean;
  writeNoResp: boolean;
  notify: boolean;
  indicate: boolean;
}

export interface Characteristic {
  uuid: string;
  name: string;
  value?: string;
  capabilities: CharacteristicCapabilities;
  subscribed: boolean;
  lastWritten?: Date;
}

export interface Service {
  uuid: string;
  name: string;
  characteristics: Record<string, Characteristic>;
}

export interface Connection {
  deviceId: string;
  connected: boolean;
  services: Record<string, Service>;
  connectedAt?: Date;
  lastActivity?: Date;
}

export interface ScanStatus {
  status: 'started' | 'completed' | 'failed';
  deviceCount?: number;
  error?: string;
}

export interface DeviceDiscoveredEvent {
  device: Device;
}

export interface DeviceUpdatedEvent {
  device: Device;
}

export interface ConnectionChangedEvent {
  deviceId: string;
  status: 'connected' | 'disconnected' | 'lost';
  connection?: Connection;
}

export interface CharacteristicValueEvent {
  deviceId: string;
  serviceId: string;
  characteristicId: string;
  value: string;
  timestamp: Date;
  direction?: 'read' | 'write' | 'notification';
}

export interface TestStep {
  action: 'scan' | 'connect' | 'disconnect' | 'read' | 'write' | 'subscribe' | 'unsubscribe';
  deviceId?: string;
  serviceId?: string;
  characteristicId?: string;
  data?: string;
  callback?: (data: any) => void;
}

export interface TestResult {
  step: TestStep;
  success: boolean;
  result?: any;
  error?: string;
}

export interface MockState {
  devices: Device[];
  connections: [string, Connection][];
  scanning: boolean;
}

// BLE API exposed by preload script
export interface BLEAPI {
  // Core BLE operations
  scan(): Promise<Device[]>;
  connect(deviceId: string): Promise<Connection>;
  disconnect(deviceId: string): Promise<void>;
  read(deviceId: string, serviceId: string, characteristicId: string): Promise<{ value: string; timestamp: Date }>;
  write(deviceId: string, serviceId: string, characteristicId: string, data: string): Promise<{ success: boolean; timestamp: Date }>;
  subscribe(deviceId: string, serviceId: string, characteristicId: string, callback: (data: any) => void): Promise<() => void>;
  unsubscribe(deviceId: string, serviceId: string, characteristicId: string): Promise<{ success: boolean }>;
  
  // Device information
  getRSSI(deviceId: string): number | null;
  getAdvertisingData(deviceId: string): Record<string, any> | null;
  getServices(deviceId: string): Record<string, Service> | null;
  getCharacteristics(deviceId: string, serviceId: string): Record<string, Characteristic> | null;
  isConnected(deviceId: string): boolean;
  
  // Event listeners
  onDeviceDiscovered(callback: (event: DeviceDiscoveredEvent) => void): void;
  onDeviceUpdated(callback: (event: DeviceUpdatedEvent) => void): void;
  onConnectionChanged(callback: (event: ConnectionChangedEvent) => void): void;
  onCharacteristicValue(callback: (event: CharacteristicValueEvent) => void): void;
  onScanStatus(callback: (status: ScanStatus) => void): void;
  
  // Remove event listeners
  removeDeviceDiscoveredListener(callback: (event: DeviceDiscoveredEvent) => void): void;
  removeDeviceUpdatedListener(callback: (event: DeviceUpdatedEvent) => void): void;
  removeConnectionChangedListener(callback: (event: ConnectionChangedEvent) => void): void;
  removeCharacteristicValueListener(callback: (event: CharacteristicValueEvent) => void): void;
  removeScanStatusListener(callback: (status: ScanStatus) => void): void;
  
  // Testing utilities
  setDeterministicSeed(seed: number): void;
  runTestSequence(sequence: TestStep[]): Promise<TestResult[]>;
  simulateConnectionDrop(deviceId: string): Promise<void>;
  
  // Debug utilities
  getMockState(): MockState;
}

// Electron API exposed by preload script
export interface ElectronAPI {
  platform: string;
  versions: NodeJS.ProcessVersions;
  isElectron: boolean;
}

// Extend the global Window interface
declare global {
  interface Window {
    bleAPI: BLEAPI;
    electronAPI: ElectronAPI;
  }
}

// Re-export types for use in components
export type {
  Device,
  CharacteristicCapabilities,
  Characteristic,
  Service,
  Connection,
  ScanStatus,
  DeviceDiscoveredEvent,
  DeviceUpdatedEvent,
  ConnectionChangedEvent,
  CharacteristicValueEvent,
  TestStep,
  TestResult,
  MockState,
  BLEAPI,
  ElectronAPI
};
