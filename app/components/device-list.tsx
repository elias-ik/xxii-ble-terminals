import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Search, RefreshCw, WifiOff } from 'lucide-react';
import { useBLEStore } from '@/lib/ble-store';
import { generateAccessibleLabel, statusColors, getContrastColor } from '@/hooks/use-keyboard-shortcuts';

interface DeviceListProps {
  onDeviceSelect: (deviceId: string) => void;
  selectedDevice: any;
}

export function DeviceList({ onDeviceSelect, selectedDevice }: DeviceListProps) {
  const {
    getFilteredDevices,
    searchQuery,
    setSearchQuery,
    simulateConnectionLoss,
    simulateReconnection,
    scan,
    getIsScanning,
    devices,
    sidebarCollapsed,
    toggleSidebarCollapse
  } = useBLEStore();

  // Safety check for store initialization
  if (!devices) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Initializing...</p>
      </div>
    );
  }

  const filteredDevices = getFilteredDevices();
  // UI-side sorting: connected first, then unsupported to bottom, then by strongest RSSI
  const sortedDevices = [...filteredDevices].sort((a: any, b: any) => {
    // 1) Connection status
    if (a.connected && !b.connected) return -1;
    if (!a.connected && b.connected) return 1;
    // 2) Unsupported name to bottom
    const aUnsupported = isUnsupportedName(a?.name);
    const bUnsupported = isUnsupportedName(b?.name);
    if (aUnsupported && !bUnsupported) return 1;
    if (!aUnsupported && bUnsupported) return -1;
    // 3) RSSI descending
    const rssiA = typeof a.rssi === 'number' ? a.rssi : -999;
    const rssiB = typeof b.rssi === 'number' ? b.rssi : -999;
    return rssiB - rssiA;
  });
  const isScanning = getIsScanning();
  const hasScanned = devices && Object.keys(devices).length > 0;
  
  // Performance optimized - removed debug logging

  // Helper functions
  const getStatusDotColor = (device: any) => {
    switch (device.connectionStatus) {
      case 'connected':
        return statusColors.connected;
      case 'connecting':
        return statusColors.connecting;
      case 'lost':
        return statusColors.lost;
      default:
        return statusColors.disconnected;
    }
  };

  const getStatusDotTitle = (device: any) => {
    switch (device.connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'disconnecting':
        return 'Disconnecting';
      case 'lost':
        return 'Connection lost';
      default:
        return 'Disconnected';
    }
  };

  const getRssiColor = (rssi: number) => {
    if (rssi >= -50) return 'text-green-600';
    if (rssi >= -60) return 'text-green-500';
    if (rssi >= -70) return 'text-yellow-500';
    if (rssi >= -80) return 'text-orange-500';
    return 'text-red-500';
  };

  const getRssiStrength = (rssi: number) => {
    if (rssi >= -50) return 'Excellent';
    if (rssi >= -60) return 'Good';
    if (rssi >= -70) return 'Fair';
    if (rssi >= -80) return 'Poor';
    return 'Very Poor';
  };

  const formatAddress = (address: string) => {
    return address.replace(/:/g, '').slice(-6).toUpperCase();
  };

  const getDeviceDisplayName = (device: any) => {
    return device.name || `Device ${formatAddress(device.address)}`;
  };

  const truncateWithDots = (text: string, maxChars: number = 26) => {
    if (!text) return '';
    return text.length > maxChars ? text.slice(0, maxChars) + ' ..' : text;
  };

  const isUnsupportedName = (name: string | undefined) => {
    if (!name) return false;
    return name === 'Unsupported' || /^Unknown or Unsupported Device \(.*\)$/.test(name);
  };

  const truncateMiddle = (text: string, maxChars: number = 22) => {
    if (!text) return '';
    if (text.length <= maxChars) return text;
    const ellipsis = '...';
    const keep = Math.max(0, maxChars - ellipsis.length);
    const front = Math.ceil(keep / 2);
    const back = Math.floor(keep / 2);
    return text.slice(0, front) + ellipsis + text.slice(text.length - back);
  };

  const getConnectionBadge = (device: any) => {
    const base = 'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] h-5 border';
    switch (device.connectionStatus) {
      case 'connected':
        return <span className={`${base} bg-green-100 text-green-800 border-green-200`}>Connected</span>;
      case 'connecting':
        return <span className={`${base} bg-yellow-100 text-yellow-800 border-yellow-200`}>Connecting</span>;
      case 'disconnecting':
        return <span className={`${base} bg-orange-100 text-orange-800 border-orange-200`}>Disconnecting</span>;
      case 'lost':
        return <span className={`${base} bg-red-100 text-red-800 border-red-200`}>Lost</span>;
      default:
        return <span className={`${base} text-muted-foreground border-border`}>Disconnected</span>;
    }
  };

  const handleDeviceClick = (deviceId: string) => {
    onDeviceSelect(deviceId);
  };

  const handleDeviceKeyDown = (event: React.KeyboardEvent, deviceId: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleDeviceClick(deviceId);
    }
  };

  const handleRescan = async () => {
    try {
      const ble = (window as any)?.bleAPI;
      if (ble?.scan) {
        await ble.scan();
      } else {
        // Fallback to store action
        scan();
      }
    } catch (e) {
      // noop – errors are emitted via events
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setSearchQuery('');
      (e.currentTarget as HTMLInputElement).blur();
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">

      {/* Search */}
      <div className="p-2 border-b">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search devices..."
              value={searchQuery}
              onChange={handleSearchChange}
              onKeyDown={handleSearchKeyDown}
              className="pl-9 h-8 text-sm"
              aria-label="Search devices"
            />
          </div>
          <Button
            onClick={handleRescan}
            disabled={isScanning}
            variant="outline"
            size="sm"
            className="shrink-0"
            aria-label="Scan for devices"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
            Rescan
          </Button>
        </div>
      </div>

      {/* Device List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2">
          {filteredDevices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <WifiOff className="h-8 w-8 mx-auto mb-2 opacity-50" />
              {!hasScanned ? (
                <>
                  <p className="text-sm">No devices scanned yet</p>
                  <p className="text-xs mb-4">Click Rescan to search for devices</p>
                  <Button
                    onClick={handleRescan}
                    disabled={isScanning}
                    className="w-full"
                    aria-label="Scan for devices"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Scan for Devices
                  </Button>
                </>
              ) : searchQuery ? (
                <p className="text-sm">No devices match your search</p>
              ) : (
                <p className="text-sm">No devices found</p>
              )}
            </div>
          ) : (
            sortedDevices.map((device) => {
              const isSelected = selectedDevice?.id === device.id;
              const statusColor = getStatusDotColor(device);
              const statusTitle = getStatusDotTitle(device);
              const accessibleLabel = generateAccessibleLabel('device-row', device);
              
              return (
                <div
                  key={device.id}
                  className={`px-2 py-1 border-b cursor-pointer select-none ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  } ${device.connectionStatus === 'lost' ? 'bg-orange-50/50' : ''}`}
                  onClick={() => handleDeviceClick(device.id)}
                  onKeyDown={(e) => handleDeviceKeyDown(e, device.id)}
                  tabIndex={0}
                  role="button"
                  aria-label={accessibleLabel}
                  aria-pressed={isSelected}
                >
                  <div className="flex-1 min-w-0">
                    {/* Line 1: status dot, name, connection badge */}
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: statusColor }}
                        role="img"
                        aria-label={`Status: ${statusTitle}`}
                        title={statusTitle}
                      />
                      {(() => {
                        const fullName = getDeviceDisplayName(device);
                        const maxChars = 26;
                        const isTruncated = fullName.length > maxChars;
                        const shown = truncateWithDots(fullName, maxChars);
                        return (
                          <HoverCard openDelay={150}>
                            <HoverCardTrigger asChild>
                              <span className="font-medium text-[13px] cursor-default">
                                {shown}
                              </span>
                            </HoverCardTrigger>
                            {isTruncated && (
                              <HoverCardContent side="top" align="start" className="max-w-xs">
                                <div className="text-sm break-words">{fullName}</div>
                              </HoverCardContent>
                            )}
                          </HoverCard>
                        );
                      })()}
                      <div className="ml-auto flex items-center gap-2">
                        {getConnectionBadge(device)}
                      </div>
                    </div>

                    {/* Line 2: full MAC, RSSI + strength */}
                    <div className="mt-0.5 flex items-center justify-between text-[11px] text-muted-foreground leading-tight">
                      <span className="font-mono">{truncateMiddle(device.address || '')}</span>
                      <span className="flex items-center gap-1">
                        <span className={getRssiColor(device.rssi)}>{device.rssi}dBm</span>
                        <span>({getRssiStrength(device.rssi)})</span>
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {/* Bottom spacer to mirror top padding for symmetry */}
          <div className="h-2" />
        </div>
      </ScrollArea>
    </div>
  );
}
