import { useEffect, useRef, useCallback, useState, type RefObject } from 'react';
import { useBLEStore } from '@/lib/ble-store';
import { categorizeRssi } from '@/lib/utils';

export interface KeyboardShortcuts {
  // Focus management
  focusInput: () => void;
  focusSearch: () => void;
  
  // Console operations
  sendMessage: () => void;
  clearConsole: () => void;
  
  // UI operations
  closeOverlay: () => void;
  toggleSidebar: () => void;
  
  // Device operations
  rescan: () => void;
  connectSelected: () => void;
  disconnectSelected: () => void;

  // Refs for components to use
  inputRef: RefObject<HTMLInputElement | null>;
  searchRef: RefObject<HTMLInputElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
}

export function useKeyboardShortcuts(): KeyboardShortcuts {
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  
  const {
    selectedDeviceId,
    clearConsole,
    scan,
    connect,
    disconnect,
    toggleSidebarCollapse,
    sidebarCollapsed
  } = useBLEStore();

  // Focus management functions
  const focusInput = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const focusSearch = useCallback(() => {
    if (searchRef.current) {
      searchRef.current.focus();
    }
  }, []);

  // Console operations
  const sendMessage = useCallback(() => {
    if (inputRef.current) {
      const event = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      inputRef.current.dispatchEvent(event);
    }
  }, []);

  const clearConsoleAction = useCallback(() => {
    if (selectedDeviceId) {
      clearConsole(selectedDeviceId);
    }
  }, [selectedDeviceId, clearConsole]);

  // UI operations
  const closeOverlay = useCallback(() => {
    // This will be handled by individual overlay components
    // The hook provides the function for them to use
  }, []);

  const toggleSidebar = useCallback(() => {
    toggleSidebarCollapse(!sidebarCollapsed);
  }, [sidebarCollapsed, toggleSidebarCollapse]);

  // Device operations
  const rescan = useCallback(() => {
    scan();
  }, [scan]);

  const connectSelected = useCallback(() => {
    if (selectedDeviceId) {
      connect(selectedDeviceId);
    }
  }, [selectedDeviceId, connect]);

  const disconnectSelected = useCallback(() => {
    if (selectedDeviceId) {
      disconnect(selectedDeviceId);
    }
  }, [selectedDeviceId, disconnect]);

  // Keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Don't handle shortcuts when typing in input fields
    if (event.target instanceof HTMLInputElement || 
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLSelectElement) {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modifierKey = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl+K: Focus input
    if (modifierKey && event.key === 'k') {
      event.preventDefault();
      focusInput();
    }
    
    // Cmd/Ctrl+L: Clear console
    if (modifierKey && event.key === 'l') {
      event.preventDefault();
      clearConsoleAction();
    }
    
    // Cmd/Ctrl+F: Focus search
    if (modifierKey && event.key === 'f') {
      event.preventDefault();
      focusSearch();
    }
    
    // Cmd/Ctrl+R: Rescan
    if (modifierKey && event.key === 'r') {
      event.preventDefault();
      rescan();
    }
    
    // Cmd/Ctrl+Enter: Connect selected device
    if (modifierKey && event.key === 'Enter') {
      event.preventDefault();
      connectSelected();
    }
    
    // Cmd/Ctrl+Shift+Enter: Disconnect selected device
    if (modifierKey && event.shiftKey && event.key === 'Enter') {
      event.preventDefault();
      disconnectSelected();
    }
    
    // Cmd/Ctrl+B: Toggle sidebar
    if (modifierKey && event.key === 'b') {
      event.preventDefault();
      toggleSidebar();
    }
    
    // Escape: Close overlay
    if (event.key === 'Escape') {
      event.preventDefault();
      closeOverlay();
    }
  }, [
    focusInput,
    focusSearch,
    sendMessage,
    clearConsoleAction,
    closeOverlay,
    toggleSidebar,
    rescan,
    connectSelected,
    disconnectSelected
  ]);

  // Set up keyboard listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return {
    focusInput,
    focusSearch,
    sendMessage,
    clearConsole: clearConsoleAction,
    closeOverlay,
    toggleSidebar,
    rescan,
    connectSelected,
    disconnectSelected,
    // Refs for components to use
    inputRef,
    searchRef,
    overlayRef
  };
}

// Hook for managing focus rings
export function useFocusRing() {
  const [showFocusRing, setShowFocusRing] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        setShowFocusRing(true);
      }
    };

    const handleMouseDown = () => {
      setShowFocusRing(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return showFocusRing;
}

// Hook for screen reader announcements
export function useScreenReader() {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
}

// Utility for generating accessible labels
export function generateAccessibleLabel(type: string, data: any): string {
  switch (type) {
    case 'connection-status':
      const status = data.status;
      const deviceName = data.deviceName || 'Unknown device';
      switch (status) {
        case 'connected':
          return `${deviceName} is connected`;
        case 'connecting':
          return `${deviceName} is connecting`;
        case 'disconnected':
          return `${deviceName} is disconnected`;
        case 'lost':
          return `${deviceName} connection was lost`;
        default:
          return `${deviceName} connection status: ${status}`;
      }
    
    case 'rssi-strength':
      const rssi = data.rssi as number | undefined | null;
      switch (categorizeRssi(rssi)) {
        case 'excellent': return 'Excellent signal strength';
        case 'good': return 'Good signal strength';
        case 'fair': return 'Fair signal strength';
        case 'poor': return 'Poor signal strength';
        case 'very-poor': return 'Very poor signal strength';
        default: return 'Unknown signal strength';
      }
    
    case 'device-row':
      const device = data;
      const statusText = device.connected ? 'Connected' : 
                        device.previouslyConnected ? 'Previously connected' : 'Not connected';
      return `${device.name}, ${statusText}, Signal strength: ${device.rssi}dBm`;
    
    case 'console-entry':
      const entry = data;
      const direction = entry.direction === 'in' ? 'Received' : 'Sent';
      const time = entry.timestamp.toLocaleTimeString();
      return `${direction} message at ${time}, Format: ${entry.renderFormatAtTime}`;
    
    default:
      return '';
  }
}

// Utility for checking color contrast
export function getContrastColor(backgroundColor: string): 'white' | 'black' {
  // Simple contrast calculation
  const hex = backgroundColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? 'black' : 'white';
}

// WCAG AA compliant status colors
export const statusColors = {
  connected: '#22c55e', // Green
  connecting: '#f59e0b', // Amber
  disconnected: '#6b7280', // Gray
  lost: '#ef4444', // Red
  error: '#dc2626', // Red
  warning: '#f59e0b', // Amber
  info: '#3b82f6', // Blue
  success: '#22c55e' // Green
} as const;
