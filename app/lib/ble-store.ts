import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { devtools } from 'zustand/middleware';

// ============================================================================
// TYPES AND INTERFACES
// ============================================================================

export interface Device {
  id: string;
  name: string;
  address: string;
  rssi: number;
  connected: boolean;
  lastSeen: Date;
  previouslyConnected: boolean;
  connectionStatus: 'disconnected' | 'connected' | 'lost' | 'connecting' | 'disconnecting';
  connectionLostAt?: Date;
  connectedAt?: Date;
  advertisingData?: Record<string, any>;
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

export interface ConsoleEntry {
  id: string;
  direction: 'in' | 'out';
  timestamp: Date;
  rawBytes: Uint8Array;
  renderFormatAtTime: 'HEX' | 'UTF8' | 'ASCII';
  characteristicId: string;
  serviceId: string;
  deviceId: string;
  isPrevious?: boolean;
}

export interface DeviceSettings {
  sendFormat: 'HEX' | 'UTF8' | 'ASCII';
  displayFormat: 'HEX' | 'UTF8' | 'ASCII';
  hexFillerPosition: 'beginning' | 'end';
  // Framing
  messageStart: string; // e.g. "\x02" for STX, "" for none, or custom
  messageDelimiter: string; // e.g. "\x03" for ETX, "\n", "\r\n", ",", or custom
  // Optional separate RX framing (if splitFraming is true)
  splitFraming?: boolean;
  rxStart?: string;
  rxDelimiter?: string;
}

export interface ScanStatus {
  status: 'idle' | 'scanning' | 'completed' | 'failed';
  deviceCount?: number;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

// ============================================================================
// ACTION TYPES
// ============================================================================

export type BLEAction = 
  // Device Management
  | { type: 'DEVICE_DISCOVERED'; payload: Device }
  | { type: 'DEVICE_UPDATED'; payload: Device }
  | { type: 'DEVICE_REMOVED'; payload: { deviceId: string } }
  
  // Connection Management
  | { type: 'CONNECTION_STARTED'; payload: { deviceId: string } }
  | { type: 'CONNECTION_SUCCEEDED'; payload: { deviceId: string; connection: Connection } }
  | { type: 'CONNECTION_FAILED'; payload: { deviceId: string; error: string } }
  | { type: 'CONNECTION_LOST'; payload: { deviceId: string } }
  | { type: 'DISCONNECTION_STARTED'; payload: { deviceId: string } }
  | { type: 'DISCONNECTION_SUCCEEDED'; payload: { deviceId: string } }
  | { type: 'DISCONNECTION_FAILED'; payload: { deviceId: string; error: string } }
  
  // Scanning
  | { type: 'SCAN_STARTED'; payload: { startedAt: Date } }
  | { type: 'SCAN_COMPLETED'; payload: { deviceCount: number; completedAt: Date } }
  | { type: 'SCAN_FAILED'; payload: { error: string; completedAt: Date } }
  
  // Console Management
  | { type: 'CONSOLE_ENTRY_ADDED'; payload: ConsoleEntry }
  | { type: 'CONSOLE_CLEARED'; payload: { deviceId: string } }
  | { type: 'CONSOLE_MARKED_AS_PREVIOUS'; payload: { deviceId: string } }
  
  // Settings Management
  | { type: 'DEVICE_SETTINGS_UPDATED'; payload: { deviceId: string; settings: DeviceSettings } }
  
  // UI State
  | { type: 'DEVICE_SELECTED'; payload: { deviceId: string | null } }
  | { type: 'SERVICE_SELECTED'; payload: { serviceId: string | null } }
  | { type: 'CHARACTERISTIC_SELECTED'; payload: { characteristicId: string | null } }
  | { type: 'SEARCH_QUERY_UPDATED'; payload: { query: string } }
  
  // UI Persistence
  | { type: 'SIDEBAR_WIDTH_UPDATED'; payload: { width: number } }
  | { type: 'SIDEBAR_COLLAPSE_TOGGLED'; payload: { collapsed: boolean } }
  
  // Characteristic Operations
  | { type: 'CHARACTERISTIC_VALUE_RECEIVED'; payload: { deviceId: string; serviceId: string; characteristicId: string; value: Uint8Array; direction: 'read' | 'write' | 'notification' } }
  | { type: 'SUBSCRIPTION_STARTED'; payload: { deviceId: string; serviceId: string; characteristicId: string } }
  | { type: 'SUBSCRIPTION_STOPPED'; payload: { deviceId: string; serviceId: string; characteristicId: string } };

// ============================================================================
// STATE INTERFACE
// ============================================================================

export interface BLEState {
  // Core State
  devices: Record<string, Device>;
  connections: Record<string, Connection>;
  selectedDeviceId: string | null;
  scanStatus: ScanStatus;
  
  // Console Buffers per Device
  consoleBuffers: Record<string, ConsoleEntry[]>;
  
  // Settings per Device
  deviceSettings: Record<string, DeviceSettings>;
  // Per-characteristic incoming buffers for assembling framed messages
  incomingBuffers: Record<string, Uint8Array>;
  
  // UI per Device
  deviceUI: Record<string, {
    selectedServiceId: string | null;
    selectedCharacteristicId: string | null;
    selectedReadKeys: string[]; // keys of form serviceId:characteristicId
    selectedNotifyKeys: string[];
    selectedIndicateKeys: string[];
    writeMode: 'write' | 'writeNoResp' | null;
  }>;
  
  // UI State
  selectedServiceId: string | null;
  selectedCharacteristicId: string | null;
  searchQuery: string;
  
  // UI Persistence
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  
  // Action History for Debugging
  actionHistory: Array<{ action: BLEAction; timestamp: Date }>;
  
  // Actions
  dispatch: (action: BLEAction) => void;
  
  // Event Bus Integration
  setupEventListeners: () => void;
  cleanupEventListeners: () => void;
  
  // UI per Device actions
  setDeviceUI: (deviceId: string, update: Partial<BLEState['deviceUI'][string]>) => void;
  
  // High-level actions
  scan: () => Promise<void>;
  connect: (deviceId: string) => Promise<void>;
  disconnect: (deviceId: string) => Promise<void>;
  read: (deviceId: string, serviceId: string, characteristicId: string) => Promise<void>;
  write: (deviceId: string, serviceId: string, characteristicId: string, data: string) => Promise<void>;
  subscribe: (deviceId: string, serviceId: string, characteristicId: string) => Promise<void>;
  unsubscribe: (deviceId: string, serviceId: string, characteristicId: string) => Promise<void>;
  unsubscribeAll: (deviceId: string) => Promise<void>;
  
  // Console actions
  clearConsole: (deviceId: string) => void;
  markConsoleAsPrevious: (deviceId: string) => void;
  
  // Settings actions
  setDeviceSettings: (deviceId: string, settings: Partial<DeviceSettings>) => void;
  
  // Selection actions
  selectDevice: (deviceId: string | null) => void;
  selectService: (serviceId: string | null) => void;
  selectCharacteristic: (characteristicId: string | null) => void;
  
  // Search actions
  setSearchQuery: (query: string) => void;
  
  // UI Persistence actions
  setSidebarWidth: (width: number) => void;
  toggleSidebarCollapse: (collapsed: boolean) => void;
  
  // Utility functions
  formatDataForSend: (data: string, format: 'HEX' | 'UTF8' | 'ASCII', hexFillerPosition: 'beginning' | 'end') => string;
  formatDataForDisplay: (data: string, format: 'HEX' | 'UTF8' | 'ASCII') => string;
  validateHexInput: (input: string, fillerPosition: 'beginning' | 'end') => { isValid: boolean; formatted?: string; error?: string };
  
  // Selector wrappers
  getSortedFilteredDevices: () => Device[];
  getFilteredDevices: () => Device[];
  getSelectedDevice: () => Device | null;
  getConnection: (deviceId: string) => Connection | null;
  getActiveConnections: () => Connection[];
  getCurrentCharacteristic: () => Characteristic | null;
  getAvailableServices: (deviceId: string) => Service[];
  getAvailableCharacteristics: (deviceId: string, serviceId: string) => Characteristic[];
  getConsoleEntries: (deviceId: string) => ConsoleEntry[];
  getDeviceSettings: (deviceId: string) => DeviceSettings;
  getDeviceUI: (deviceId: string) => BLEState['deviceUI'][string];
  getIsScanning: () => boolean;
  getScanError: () => string | undefined;
  getActionHistory: () => Array<{ action: BLEAction; timestamp: Date }>;
  getLastAction: () => { action: BLEAction; timestamp: Date } | null;
  getActiveSubscriptions: (deviceId: string) => Array<{ serviceId: string; characteristicId: string }>;
  
  // Simulation methods (for testing)
  simulateConnectionLoss: (deviceId: string) => void;
  simulateReconnection: (deviceId: string) => void;
}

// ============================================================================
// REDUCERS
// ============================================================================

function bleReducer(state: Omit<BLEState, 'dispatch' | 'setupEventListeners' | 'cleanupEventListeners'>, action: BLEAction): Omit<BLEState, 'dispatch' | 'setupEventListeners' | 'cleanupEventListeners'> {
  const newState = { ...state };
  
  // Add action to history for debugging
  newState.actionHistory = [
    ...newState.actionHistory.slice(-99), // Keep last 100 actions
    { action, timestamp: new Date() }
  ];
  
  switch (action.type) {
    // Device Management
    case 'DEVICE_DISCOVERED':
      newState.devices = {
        ...newState.devices,
        [action.payload.id]: action.payload
      };
      break;
      
    case 'DEVICE_UPDATED':
      newState.devices = {
        ...newState.devices,
        [action.payload.id]: action.payload
      };
      break;
      
    case 'DEVICE_REMOVED':
      const { [action.payload.deviceId]: removed, ...remainingDevices } = newState.devices;
      newState.devices = remainingDevices;
      break;
      
    // Connection Management
    case 'CONNECTION_STARTED':
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connectionStatus: 'connecting'
        };
      }
      break;
      
    case 'CONNECTION_SUCCEEDED':
      newState.connections = {
        ...newState.connections,
        [action.payload.deviceId]: action.payload.connection
      };
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connected: true,
          previouslyConnected: true,
          connectionStatus: 'connected',
          connectedAt: new Date()
        };
      }
      break;
      
    case 'CONNECTION_FAILED':
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connectionStatus: 'disconnected'
        };
      }
      break;
      
    case 'CONNECTION_LOST':
      const { [action.payload.deviceId]: lostConnection, ...remainingConnections } = newState.connections;
      newState.connections = remainingConnections;
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connected: false,
          previouslyConnected: true,
          connectionStatus: 'lost',
          connectionLostAt: new Date()
        };
      }
      break;
      
    case 'DISCONNECTION_STARTED':
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connectionStatus: 'disconnecting'
        };
      }
      break;
      
    case 'DISCONNECTION_SUCCEEDED':
      const { [action.payload.deviceId]: disconnected, ...activeConnections } = newState.connections;
      newState.connections = activeConnections;
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connected: false,
          previouslyConnected: true,
          connectionStatus: 'disconnected',
          connectionLostAt: new Date()
        };
      }
      break;
      
    case 'DISCONNECTION_FAILED':
      if (newState.devices[action.payload.deviceId]) {
        newState.devices[action.payload.deviceId] = {
          ...newState.devices[action.payload.deviceId],
          connectionStatus: 'connected'
        };
      }
      break;
      
    // Scanning
    case 'SCAN_STARTED':
      newState.scanStatus = {
        status: 'scanning',
        startedAt: action.payload.startedAt
      };
      break;
      
    case 'SCAN_COMPLETED':
      newState.scanStatus = {
        status: 'completed',
        deviceCount: action.payload.deviceCount,
        completedAt: action.payload.completedAt
      };
      break;
      
    case 'SCAN_FAILED':
      newState.scanStatus = {
        status: 'failed',
        error: action.payload.error,
        completedAt: action.payload.completedAt
      };
      break;
      
    // Console Management
    case 'CONSOLE_ENTRY_ADDED':
      const deviceConsole = newState.consoleBuffers[action.payload.deviceId] || [];
      newState.consoleBuffers = {
        ...newState.consoleBuffers,
        [action.payload.deviceId]: [...deviceConsole, action.payload]
      };
      break;
      
    case 'CONSOLE_CLEARED':
      newState.consoleBuffers = {
        ...newState.consoleBuffers,
        [action.payload.deviceId]: []
      };
      break;
      
    case 'CONSOLE_MARKED_AS_PREVIOUS':
      const deviceConsoleToMark = newState.consoleBuffers[action.payload.deviceId] || [];
      newState.consoleBuffers = {
        ...newState.consoleBuffers,
        [action.payload.deviceId]: deviceConsoleToMark.map(entry => ({
          ...entry,
          isPrevious: true
        }))
      };
      break;
      
    // Settings Management
    case 'DEVICE_SETTINGS_UPDATED':
      newState.deviceSettings = {
        ...newState.deviceSettings,
        [action.payload.deviceId]: action.payload.settings
      };
      break;
      
    // UI State
    case 'DEVICE_SELECTED':
      newState.selectedDeviceId = action.payload.deviceId;
      break;
      
    case 'SERVICE_SELECTED':
      newState.selectedServiceId = action.payload.serviceId;
      break;
      
    case 'CHARACTERISTIC_SELECTED':
      newState.selectedCharacteristicId = action.payload.characteristicId;
      break;
      
    case 'SEARCH_QUERY_UPDATED':
      newState.searchQuery = action.payload.query;
      break;
      
    // UI Persistence
    case 'SIDEBAR_WIDTH_UPDATED':
      newState.sidebarWidth = action.payload.width;
      break;
      
    case 'SIDEBAR_COLLAPSE_TOGGLED':
      newState.sidebarCollapsed = action.payload.collapsed;
      break;
      
    // Characteristic Operations
    case 'CHARACTERISTIC_VALUE_RECEIVED':
      // This will be handled by the console entry addition
      break;
      
    case 'SUBSCRIPTION_STARTED':
      if (newState.connections[action.payload.deviceId]) {
        const service = newState.connections[action.payload.deviceId].services[action.payload.serviceId];
        if (service && service.characteristics[action.payload.characteristicId]) {
          service.characteristics[action.payload.characteristicId].subscribed = true;
        }
      }
      break;
      
    case 'SUBSCRIPTION_STOPPED':
      if (newState.connections[action.payload.deviceId]) {
        const service = newState.connections[action.payload.deviceId].services[action.payload.serviceId];
        if (service && service.characteristics[action.payload.characteristicId]) {
          service.characteristics[action.payload.characteristicId].subscribed = false;
        }
      }
      break;
  }
  
  return newState;
}

// ============================================================================
// SELECTORS (DERIVATIONS)
// ============================================================================

export const selectors = {
  // Device Selectors
  getConnectedDevices: (state: BLEState) => 
    Object.values(state.devices).filter(device => device.connected),
    
  getSortedUnconnectedDevices: (state: BLEState) => 
    Object.values(state.devices)
      .filter(device => !device.connected)
      .sort((a, b) => {
        // Previously connected devices first
        if (a.previouslyConnected && !b.previouslyConnected) return -1;
        if (!a.previouslyConnected && b.previouslyConnected) return 1;
        // Then by RSSI (stronger signal first)
        return b.rssi - a.rssi;
      }),
      
  getFilteredDevices: (state: BLEState) => {
    // Safety check for when state is not yet initialized
    if (!state || !state.devices) {
      return [];
    }
    
    const allDevices = Object.values(state.devices);
    
    if (!state.searchQuery.trim()) {
      return allDevices;
    }
    
    const query = state.searchQuery.toLowerCase();
    return allDevices.filter(device => 
      device.name.toLowerCase().includes(query) ||
      device.address.toLowerCase().includes(query)
    );
  },

  // Connected devices first, then by strongest RSSI; respects current search query
  getSortedFilteredDevices: (state: BLEState) => {
    if (!state || !state.devices) {
      return [];
    }

    const query = state.searchQuery.trim().toLowerCase();
    let list = Object.values(state.devices);
    if (query) {
      list = list.filter((device) =>
        device.name.toLowerCase().includes(query) ||
        device.address.toLowerCase().includes(query)
      );
    }

    // Sort: connected first, then by RSSI (higher/less negative first)
    return list.sort((a, b) => {
      if (a.connected && !b.connected) return -1;
      if (!a.connected && b.connected) return 1;
      return (b.rssi ?? -999) - (a.rssi ?? -999);
    });
  },
  
  getSelectedDevice: (state: BLEState) => 
    state.selectedDeviceId ? state.devices[state.selectedDeviceId] : null,
    
  // Connection Selectors
  getConnection: (state: BLEState, deviceId: string) => 
    state.connections[deviceId] || null,
    
  getActiveConnections: (state: BLEState) => 
    Object.values(state.connections).filter(conn => conn.connected),
    
  // Characteristic Selectors
  getCurrentCharacteristic: (state: BLEState) => {
    if (!state.selectedDeviceId || !state.selectedServiceId || !state.selectedCharacteristicId) {
      return null;
    }
    
    const connection = state.connections[state.selectedDeviceId];
    if (!connection) return null;
    
    const service = connection.services[state.selectedServiceId];
    if (!service) return null;
    
    return service.characteristics[state.selectedCharacteristicId] || null;
  },
  
  getAvailableServices: (state: BLEState, deviceId: string) => {
    const connection = state.connections[deviceId];
    return connection ? Object.values(connection.services) : [];
  },
  
  getAvailableCharacteristics: (state: BLEState, deviceId: string, serviceId: string) => {
    const connection = state.connections[deviceId];
    if (!connection) return [];
    
    const service = connection.services[serviceId];
    return service ? Object.values(service.characteristics) : [];
  },
  
  // Console Selectors
  getConsoleEntries: (state: BLEState, deviceId: string) => 
    state.consoleBuffers[deviceId] || [],
    
  // Settings Selectors
  getDeviceSettings: (state: BLEState, deviceId: string): DeviceSettings => 
    state.deviceSettings[deviceId] || {
      sendFormat: 'ASCII',
      displayFormat: 'ASCII',
      hexFillerPosition: 'end',
      messageStart: '',
      messageDelimiter: '',
      splitFraming: false,
      rxStart: '',
      rxDelimiter: ''
    },
  
  // UI per Device selector
  getDeviceUI: (state: BLEState, deviceId: string) => {
    return state.deviceUI[deviceId] || {
      selectedServiceId: null,
      selectedCharacteristicId: null,
      selectedReadKeys: [],
      selectedNotifyKeys: [],
      selectedIndicateKeys: [],
      writeMode: null
    };
  },
    
  // Scan Status Selectors
  getIsScanning: (state: BLEState) => {
    return state.scanStatus.status === 'scanning';
  },
    
  getScanError: (state: BLEState) => 
    state.scanStatus.error,
    
  // Action History Selectors
  getActionHistory: (state: BLEState) => 
    state.actionHistory,
    
  getLastAction: (state: BLEState) => 
    state.actionHistory[state.actionHistory.length - 1]
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatDataForSend(data: string, format: 'HEX' | 'UTF8' | 'ASCII', fillerPosition: 'beginning' | 'end'): string {
  switch (format) {
    case 'HEX':
      // Remove spaces and validate hex
      const cleanHex = data.replace(/\s/g, '').toUpperCase();
      if (!/^[0-9A-F]*$/.test(cleanHex)) {
        throw new Error('Invalid hex characters');
      }
      // Add filler byte if odd length
      if (cleanHex.length % 2 === 1) {
        const filler = '0';
        return fillerPosition === 'beginning' ? filler + cleanHex : cleanHex + filler;
      }
      return cleanHex;
    case 'UTF8':
      return data;
    case 'ASCII':
      return data;
    default:
      return data;
  }
}

function hexStringToBytes(hex: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }
  return new Uint8Array(bytes);
}

// Parse a framing string (e.g., "\x02", "\n", "\r\n", ",", or literal chars) into bytes
function framingStringToBytes(input: string): Uint8Array {
  if (!input) return new Uint8Array();
  // Replace common escapes first
  let s = input;
  s = s.replace(/\\r\\n/g, '\r\n');
  s = s.replace(/\\n/g, '\n');
  s = s.replace(/\\r/g, '\r');
  // Handle \xNN sequences
  const parts: number[] = [];
  for (let i = 0; i < s.length; ) {
    if (s[i] === '\\' && i + 3 < s.length && s[i+1] === 'x') {
      const hex = s.substring(i + 2, i + 4);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        parts.push(parseInt(hex, 16));
        i += 4;
        continue;
      }
    }
    parts.push(s.charCodeAt(i));
    i += 1;
  }
  return new Uint8Array(parts);
}

function formatDataForDisplay(data: string, format: 'HEX' | 'UTF8' | 'ASCII'): string {
  switch (format) {
    case 'HEX':
      // Convert to hex representation
      return Array.from(new TextEncoder().encode(data))
        .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');
    case 'UTF8':
      return data;
    case 'ASCII':
      return data;
    default:
      return data;
  }
}

function validateHexInput(input: string, fillerPosition: 'beginning' | 'end'): { isValid: boolean; formatted?: string; error?: string } {
  const cleanInput = input.replace(/\s/g, '').toUpperCase();
  
  if (!/^[0-9A-F]*$/.test(cleanInput)) {
    return { isValid: false, error: 'Invalid hex characters' };
  }
  
  if (cleanInput.length === 0) {
    return { isValid: true, formatted: '' };
  }
  
  let formatted = cleanInput;
  if (cleanInput.length % 2 === 1) {
    const filler = '0';
    formatted = fillerPosition === 'beginning' ? filler + cleanInput : cleanInput + filler;
  }
  
  // Add spaces for readability
  formatted = formatted.match(/.{1,2}/g)?.join(' ') || formatted;
  
  return { isValid: true, formatted };
}

// ============================================================================
// STORE CREATION
// ============================================================================

export const useBLEStore = create<BLEState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // Initial State
      devices: {},
      connections: {},
      selectedDeviceId: null,
      scanStatus: { status: 'idle' },
      consoleBuffers: {},
      deviceSettings: {},
      incomingBuffers: {},
      deviceUI: {},
      selectedServiceId: null,
      selectedCharacteristicId: null,
      searchQuery: '',
      sidebarWidth: 320, // Default sidebar width
      sidebarCollapsed: false, // Default sidebar state
      actionHistory: [],
      
      // Actions
      dispatch: (action: BLEAction) => {
        set((state) => bleReducer(state, action));
      },
      
      // Mock Event Bus Integration (no real BLE API needed)
      setupEventListeners: () => {
        // Avoid double-binding in dev HMR
        const w = window as any;
        if (w.__bleHandlersBound) return;
        w.__bleHandlersBound = true;

        const { dispatch } = get();
        const ble = (window as any)?.bleAPI;
        if (!ble) {
          console.warn('bleAPI not available on window');
          return;
        }

        // Handlers
        const onScanStatus = (evt: { status: 'idle' | 'scanning' | 'completed' | 'failed' | 'started'; deviceCount?: number; error?: string }) => {
          if (evt.status === 'scanning' || evt.status === 'started') {
            dispatch({ type: 'SCAN_STARTED', payload: { startedAt: new Date() } });
          } else if (evt.status === 'completed') {
            dispatch({ type: 'SCAN_COMPLETED', payload: { deviceCount: evt.deviceCount ?? 0, completedAt: new Date() } });
          } else if (evt.status === 'failed') {
            dispatch({ type: 'SCAN_FAILED', payload: { error: evt.error || 'Unknown error', completedAt: new Date() } });
          }
        };

        const onDeviceDiscovered = (device: Device) => {
          dispatch({ type: 'DEVICE_DISCOVERED', payload: device });
        };

        const onDeviceUpdated = (device: Device) => {
          dispatch({ type: 'DEVICE_UPDATED', payload: device });
        };

        const onConnectionChanged = (evt: { deviceId: string; state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected' | 'lost'; connection?: Connection }) => {
          switch (evt.state) {
            case 'connecting':
              dispatch({ type: 'CONNECTION_STARTED', payload: { deviceId: evt.deviceId } });
              break;
            case 'connected':
              if (evt.connection) {
                dispatch({ type: 'CONNECTION_SUCCEEDED', payload: { deviceId: evt.deviceId, connection: evt.connection } });
                // Initialize per-device UI state on first connect
                set((state) => ({
                  deviceUI: {
                    ...state.deviceUI,
                    [evt.deviceId]: state.deviceUI[evt.deviceId] || {
                      selectedServiceId: null,
                      selectedCharacteristicId: null,
                      selectedReadKeys: [],
                      selectedNotifyKeys: [],
                      selectedIndicateKeys: [],
                      writeMode: null
                    }
                  }
                }));
              }
              break;
            case 'disconnecting':
              dispatch({ type: 'DISCONNECTION_STARTED', payload: { deviceId: evt.deviceId } });
              break;
            case 'disconnected':
              dispatch({ type: 'DISCONNECTION_SUCCEEDED', payload: { deviceId: evt.deviceId } });
              break;
            case 'lost':
              dispatch({ type: 'CONNECTION_LOST', payload: { deviceId: evt.deviceId } });
              break;
          }
        };

        const onSubscriptionChanged = (evt: { deviceId: string; serviceId: string; characteristicId: string; action: 'started' | 'stopped' }) => {
          if (evt.action === 'started') {
            dispatch({ type: 'SUBSCRIPTION_STARTED', payload: { deviceId: evt.deviceId, serviceId: evt.serviceId, characteristicId: evt.characteristicId } });
          } else {
            dispatch({ type: 'SUBSCRIPTION_STOPPED', payload: { deviceId: evt.deviceId, serviceId: evt.serviceId, characteristicId: evt.characteristicId } });
          }
        };

        const onCharacteristicValue = (evt: { deviceId: string; serviceId: string; characteristicId: string; value: Uint8Array; direction: 'read' | 'write' | 'notification' }) => {
          const settings = selectors.getDeviceSettings(get(), evt.deviceId);
          const payload = evt.value instanceof Uint8Array ? evt.value : new Uint8Array();
          // If inbound (not our echoed write), accumulate by delimiter, emit complete messages
          if (evt.direction !== 'write') {
            const key = `${evt.deviceId}|${evt.serviceId}|${evt.characteristicId}`;
            const state = get();
            const prev = state.incomingBuffers[key] || new Uint8Array();
            // Append payload
            const combined = new Uint8Array(prev.length + payload.length);
            combined.set(prev, 0);
            combined.set(payload, prev.length);

            // Compute delimiter bytes (use RX-specific if enabled)
            const rxDelimStr = settings.splitFraming ? (settings.rxDelimiter || '') : (settings.messageDelimiter || '');
            const delimiter = framingStringToBytes(rxDelimStr);
            if (delimiter.length === 0) {
              // No delimiter: push chunk as-is and store combined for potential future framing
              set((s) => ({ incomingBuffers: { ...s.incomingBuffers, [key]: combined } }));
              const consoleEntry: ConsoleEntry = {
                id: `${evt.deviceId}-${evt.serviceId}-${evt.characteristicId}-${Date.now()}`,
                direction: 'in',
                timestamp: new Date(),
                rawBytes: payload,
                renderFormatAtTime: settings.displayFormat,
                characteristicId: evt.characteristicId,
                serviceId: evt.serviceId,
                deviceId: evt.deviceId
              };
              dispatch({ type: 'CONSOLE_ENTRY_ADDED', payload: consoleEntry });
            } else {
              // Scan for delimiter sequences and emit complete messages
              const messages: Uint8Array[] = [];
              let searchFrom = 0;
              let buffer = combined;
              const delim = delimiter;
              // naive search
              const indexOfDelim = (arr: Uint8Array, from: number): number => {
                outer: for (let i = from; i <= arr.length - delim.length; i++) {
                  for (let j = 0; j < delim.length; j++) {
                    if (arr[i + j] !== delim[j]) continue outer;
                  }
                  return i;
                }
                return -1;
              };
              let idx = indexOfDelim(buffer, searchFrom);
              while (idx !== -1) {
                const msg = buffer.slice(0, idx);
                messages.push(msg);
                buffer = buffer.slice(idx + delim.length);
                idx = indexOfDelim(buffer, 0);
              }
              // Save remainder
              set((s) => ({ incomingBuffers: { ...s.incomingBuffers, [key]: buffer } }));

              // Emit each complete message
              for (const msg of messages) {
                const consoleEntry: ConsoleEntry = {
                  id: `${evt.deviceId}-${evt.serviceId}-${evt.characteristicId}-${Date.now()}`,
                  direction: 'in',
                  timestamp: new Date(),
                  rawBytes: msg,
                  renderFormatAtTime: settings.displayFormat,
                  characteristicId: evt.characteristicId,
                  serviceId: evt.serviceId,
                  deviceId: evt.deviceId
                };
                dispatch({ type: 'CONSOLE_ENTRY_ADDED', payload: consoleEntry });
              }
            }
          } else {
            // Echoed write event: ignore to prevent duplicate outbound entries
          }
          dispatch({ type: 'CHARACTERISTIC_VALUE_RECEIVED', payload: { ...evt } });
        };

        // Save handlers for cleanup
        // Bind to preload-exposed BLE API events
        w.__bleHandlers = { onScanStatus, onDeviceDiscovered, onDeviceUpdated, onConnectionChanged, onSubscriptionChanged, onCharacteristicValue };
        ble.onScanStatus(onScanStatus);
        ble.onDeviceDiscovered((evt: any) => onDeviceDiscovered(evt.device ?? evt));
        ble.onDeviceUpdated((evt: any) => onDeviceUpdated(evt.device ?? evt));
        ble.onConnectionChanged((evt: any) => {
          const mapped = { deviceId: evt.deviceId, state: (evt.status || evt.state), connection: evt.connection };
          onConnectionChanged(mapped as any);
        });
        ble.onSubscriptionChanged(onSubscriptionChanged);
        ble.onCharacteristicValue((evt: any) => onCharacteristicValue({ ...evt, direction: evt.direction || 'notification' }));
      },
      
      cleanupEventListeners: () => {
        const w = window as any;
        if (!w.__bleHandlersBound || !w.__bleHandlers) return;
        const h = w.__bleHandlers;
        const ble = (window as any)?.bleAPI;
        if (ble) {
          // No explicit off API in types; rely on remove* where available
          if (ble.removeScanStatusListener) ble.removeScanStatusListener(h.onScanStatus);
          if (ble.removeDeviceDiscoveredListener) ble.removeDeviceDiscoveredListener(h.onDeviceDiscovered);
          if (ble.removeDeviceUpdatedListener) ble.removeDeviceUpdatedListener(h.onDeviceUpdated);
          if (ble.removeConnectionChangedListener) ble.removeConnectionChangedListener(h.onConnectionChanged);
          if (ble.removeSubscriptionChangedListener) ble.removeSubscriptionChangedListener(h.onSubscriptionChanged);
          if (ble.removeCharacteristicValueListener) ble.removeCharacteristicValueListener(h.onCharacteristicValue);
        }
        delete w.__bleHandlers;
        w.__bleHandlersBound = false;
      },
      
      // UI per Device actions
      setDeviceUI: (deviceId, update) => {
        set((state) => {
          const current = selectors.getDeviceUI(state as unknown as BLEState, deviceId);
          return {
            deviceUI: {
              ...state.deviceUI,
              [deviceId]: { ...current, ...update }
            }
          } as Partial<BLEState> as any;
        });
      },
      

      
      // High-level actions (composed from multiple dispatches)
      scan: async () => {
        try {
          const ble = (window as any).bleAPI;
          await ble.scan();
        } catch (error) {
          const { dispatch } = get();
          dispatch({ type: 'SCAN_FAILED', payload: { error: error instanceof Error ? error.message : 'Unknown error', completedAt: new Date() } });
        }
      },
      
      connect: async (deviceId: string) => {
        try {
          const ble = (window as any).bleAPI;
          await ble.connect(deviceId);
        } catch (error) {
          const { dispatch } = get();
          dispatch({ type: 'CONNECTION_FAILED', payload: { deviceId, error: error instanceof Error ? error.message : 'Unknown error' } });
        }
      },
      
      disconnect: async (deviceId: string) => {
        try {
          const ble = (window as any).bleAPI;
          await ble.disconnect(deviceId);
        } catch (error) {
          const { dispatch } = get();
          dispatch({ type: 'DISCONNECTION_FAILED', payload: { deviceId, error: error instanceof Error ? error.message : 'Unknown error' } });
        }
      },
      
      read: async (deviceId: string, serviceId: string, characteristicId: string) => {
        try {
          const ble = (window as any).bleAPI;
          await ble.read(deviceId, serviceId, characteristicId);
        } catch (error) {
          console.error('Read failed:', error);
        }
      },
      
      write: async (deviceId: string, serviceId: string, characteristicId: string, data: string) => {
        const state = get();
        const deviceSettings = selectors.getDeviceSettings(state, deviceId);
        try {
          const formattedData = formatDataForSend(data, deviceSettings.sendFormat, deviceSettings.hexFillerPosition);
          const payloadBytes = deviceSettings.sendFormat === 'HEX'
            ? hexStringToBytes(formattedData)
            : new TextEncoder().encode(formattedData);
          // Apply framing
          const startBytes = framingStringToBytes(deviceSettings.messageStart || '');
          const endBytes = framingStringToBytes(deviceSettings.messageDelimiter || '');
          const finalBytes = new Uint8Array(startBytes.length + payloadBytes.length + endBytes.length);
          finalBytes.set(startBytes, 0);
          finalBytes.set(payloadBytes, startBytes.length);
          finalBytes.set(endBytes, startBytes.length + payloadBytes.length);
          // Add outbound console entry immediately (show according to display format)
          const consoleEntry: ConsoleEntry = {
            id: `${deviceId}-${serviceId}-${characteristicId}-${Date.now()}`,
            direction: 'out',
            timestamp: new Date(),
            rawBytes: finalBytes,
            renderFormatAtTime: deviceSettings.displayFormat,
            characteristicId,
            serviceId,
            deviceId
          };
          get().dispatch({ type: 'CONSOLE_ENTRY_ADDED', payload: consoleEntry });
          const ble = (window as any).bleAPI;
          await ble.write(deviceId, serviceId, characteristicId, finalBytes);
        } catch (error) {
          console.error('Write failed:', error);
        }
      },
      
      subscribe: async (deviceId: string, serviceId: string, characteristicId: string) => {
        try {
          const ble = (window as any).bleAPI;
          await ble.subscribe(deviceId, serviceId, characteristicId, () => {});
        } catch (error) {
          console.error('Subscribe failed:', error);
        }
      },
      
      unsubscribe: async (deviceId: string, serviceId: string, characteristicId: string) => {
        try {
          const ble = (window as any).bleAPI;
          await ble.unsubscribe(deviceId, serviceId, characteristicId);
        } catch (error) {
          console.error('Unsubscribe failed:', error);
        }
      },

      // Get all active subscriptions for a device
      getActiveSubscriptions: (deviceId: string) => {
        const state = get();
        const deviceUI = selectors.getDeviceUI(state, deviceId);
        const subscriptions: Array<{ serviceId: string; characteristicId: string }> = [];
        
        // Parse notify keys
        (deviceUI.selectedNotifyKeys || []).forEach(key => {
          const [serviceId, characteristicId] = key.split(':');
          if (serviceId && characteristicId) {
            subscriptions.push({ serviceId, characteristicId });
          }
        });
        
        // Parse indicate keys
        (deviceUI.selectedIndicateKeys || []).forEach(key => {
          const [serviceId, characteristicId] = key.split(':');
          if (serviceId && characteristicId) {
            subscriptions.push({ serviceId, characteristicId });
          }
        });
        
        return subscriptions;
      },

      // Unsubscribe from all active characteristics for a device
      unsubscribeAll: async (deviceId: string) => {
        const subscriptions = get().getActiveSubscriptions(deviceId);
        const promises = subscriptions.map(({ serviceId, characteristicId }) => 
          get().unsubscribe(deviceId, serviceId, characteristicId)
        );
        await Promise.all(promises);
      },
      
      clearConsole: (deviceId: string) => {
        const { dispatch } = get();
        dispatch({ type: 'CONSOLE_CLEARED', payload: { deviceId } });
      },

      markConsoleAsPrevious: (deviceId: string) => {
        const { dispatch } = get();
        dispatch({ type: 'CONSOLE_MARKED_AS_PREVIOUS', payload: { deviceId } });
      },
      
      setDeviceSettings: (deviceId: string, settings: Partial<DeviceSettings>) => {
        const { dispatch } = get();
        const state = get();
        const currentSettings = selectors.getDeviceSettings(state, deviceId);
        const newSettings = { ...currentSettings, ...settings };
        dispatch({ type: 'DEVICE_SETTINGS_UPDATED', payload: { deviceId, settings: newSettings } });
      },
      
      selectDevice: (deviceId: string | null) => {
        const { dispatch } = get();
        dispatch({ type: 'DEVICE_SELECTED', payload: { deviceId } });
      },
      
      selectService: (serviceId: string | null) => {
        const { dispatch } = get();
        dispatch({ type: 'SERVICE_SELECTED', payload: { serviceId } });
      },
      
      selectCharacteristic: (characteristicId: string | null) => {
        const { dispatch } = get();
        dispatch({ type: 'CHARACTERISTIC_SELECTED', payload: { characteristicId } });
      },
      
      setSearchQuery: (query: string) => {
        const { dispatch } = get();
        dispatch({ type: 'SEARCH_QUERY_UPDATED', payload: { query } });
      },
      
      // UI Persistence Actions
      setSidebarWidth: (width: number) => {
        const { dispatch } = get();
        dispatch({ type: 'SIDEBAR_WIDTH_UPDATED', payload: { width } });
      },
      
      toggleSidebarCollapse: (collapsed: boolean) => {
        const { dispatch } = get();
        dispatch({ type: 'SIDEBAR_COLLAPSE_TOGGLED', payload: { collapsed } });
      },
      
      // Utility functions
      formatDataForSend,
      formatDataForDisplay,
      validateHexInput,
      
      // Selectors
      ...selectors,
      
      // Wrapper functions for selectors that need current state
      getSortedFilteredDevices: () => {
        const state = get();
        return selectors.getSortedFilteredDevices(state);
      },
      getFilteredDevices: () => {
        const state = get();
        return selectors.getFilteredDevices(state);
      },
      
      getSelectedDevice: () => {
        const state = get();
        return selectors.getSelectedDevice(state);
      },
      
      getConnection: (deviceId: string) => {
        const state = get();
        return selectors.getConnection(state, deviceId);
      },
      
      getActiveConnections: () => {
        const state = get();
        return selectors.getActiveConnections(state);
      },
      
      getCurrentCharacteristic: () => {
        const state = get();
        return selectors.getCurrentCharacteristic(state);
      },
      
      getAvailableServices: (deviceId: string) => {
        const state = get();
        return selectors.getAvailableServices(state, deviceId);
      },
      
      getAvailableCharacteristics: (deviceId: string, serviceId: string) => {
        const state = get();
        return selectors.getAvailableCharacteristics(state, deviceId, serviceId);
      },
      
      getConsoleEntries: (deviceId: string) => {
        const state = get();
        return selectors.getConsoleEntries(state, deviceId);
      },
      
      getDeviceSettings: (deviceId: string) => {
        const state = get();
        return selectors.getDeviceSettings(state, deviceId);
      },
      
      getDeviceUI: (deviceId: string) => {
        const state = get();
        return selectors.getDeviceUI(state, deviceId);
      },
      
      getIsScanning: () => {
        const state = get();
        return selectors.getIsScanning(state);
      },
      
      getScanError: () => {
        const state = get();
        return selectors.getScanError(state);
      },
      
      getActionHistory: () => {
        const state = get();
        return selectors.getActionHistory(state);
      },
      
      getLastAction: () => {
        const state = get();
        return selectors.getLastAction(state);
      },
      
      // Simulation methods (for testing)
      simulateConnectionLoss: (deviceId: string) => {
        const { dispatch } = get();
        dispatch({ type: 'CONNECTION_LOST', payload: { deviceId } });
      },
      
      simulateReconnection: (deviceId: string) => {
        const { dispatch } = get();
        dispatch({ type: 'CONNECTION_SUCCEEDED', payload: { deviceId, connection: { deviceId, connected: true, services: {} } } });
      }
    })),
    {
      name: 'ble-store',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);

// Initialize event listeners when store is created
if (typeof window !== 'undefined') {
  // Wait for the page to load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      useBLEStore.getState().setupEventListeners();
    });
  } else {
    useBLEStore.getState().setupEventListeners();
  }
}
