import React, { memo, useEffect, useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Search, RefreshCw, WifiOff } from 'lucide-react';
import { useBLEStore } from '@/lib/ble-store';
import { generateAccessibleLabel, statusColors, getContrastColor } from '@/hooks/use-keyboard-shortcuts';
import { categorizeRssi } from '@/lib/utils';
import { DeviceRow } from './device-row';

interface DeviceListProps {
  onDeviceSelect: (deviceId: string) => void;
  selectedDevice: any;
}

export function DeviceList({ onDeviceSelect, selectedDevice }: DeviceListProps) {
  const searchQuery = useBLEStore((s) => s.searchQuery);
  const setSearchQuery = useBLEStore((s) => s.setSearchQuery);
  const scan = useBLEStore((s) => s.scan);
  const getIsScanning = useBLEStore((s) => s.getIsScanning);
  const sortedDevices = useBLEStore((s) => s.getSortedFilteredDevices());
  const devices = useBLEStore((s) => s.devices);

  const isScanning = getIsScanning();
  const hasScanned = devices && Object.keys(devices).length > 0;

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
    switch (categorizeRssi(rssi)) {
      case 'excellent': return 'text-green-600';
      case 'good': return 'text-green-500';
      case 'fair': return 'text-yellow-500';
      case 'poor': return 'text-orange-500';
      case 'very-poor': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  const getRssiStrength = (rssi: number) => {
    switch (categorizeRssi(rssi)) {
      case 'excellent': return 'Excellent';
      case 'good': return 'Good';
      case 'fair': return 'Fair';
      case 'poor': return 'Poor';
      case 'very-poor': return 'Very Poor';
      default: return 'Unknown';
    }
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

  // Virtualization setup
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = scrollAreaRef.current;
    if (!root) return;
    const vp = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    viewportRef.current = vp;
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: sortedDevices.length,
    getScrollElement: () => viewportRef.current as HTMLElement | null,
    estimateSize: () => 56,
    overscan: 20,
    getItemKey: (index) => (sortedDevices[index]?.id ?? index),
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

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
      <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0">
        <div className="p-2">
          {sortedDevices.length === 0 ? (
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
            <div className="relative w-full" style={{ height: totalSize }}>
              {virtualItems.map((vItem) => {
                const device = sortedDevices[vItem.index];
                const isSelected = selectedDevice?.id === device.id;
                const accessibleLabel = generateAccessibleLabel('device-row', device);
                const fullName = getDeviceDisplayName(device);
                const maxChars = 26;
                const isTruncated = fullName.length > maxChars;
                const shown = truncateWithDots(fullName, maxChars);
                return (
                  <div
                    key={device.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={vItem.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${vItem.start}px)`,
                      willChange: 'transform',
                      contain: 'layout paint',
                    }}
                  >
                    <DeviceRow
                      id={device.id}
                      isSelected={isSelected}
                      statusColor={getStatusDotColor(device)}
                      statusTitle={getStatusDotTitle(device)}
                      shownName={shown}
                      fullName={fullName}
                      isTruncated={isTruncated}
                      addressShown={truncateMiddle(device.address || '')}
                      rssi={device.rssi}
                      rssiColor={getRssiColor(device.rssi)}
                      rssiStrength={getRssiStrength(device.rssi)}
                      connectionBadge={getConnectionBadge(device)}
                      accessibleLabel={accessibleLabel}
                      onSelect={handleDeviceClick}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {/* Bottom spacer to mirror top padding for symmetry */}
          <div className="h-2" />
        </div>
      </ScrollArea>
    </div>
  );
}
