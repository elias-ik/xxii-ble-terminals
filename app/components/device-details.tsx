import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Signal, Wifi, WifiOff, Clock, AlertCircle, CheckCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useBLEStore, type Device } from "@/lib/ble-store";
import { TerminalConsole } from "./terminal-console-simple";
import { useEffect, useState } from "react";

interface DeviceDetailsProps {
  device: Device;
}

export function DeviceDetails({ device }: DeviceDetailsProps) {
  const {
    connect,
    disconnect,
    connections,
    devices
  } = useBLEStore();

  const connection = connections[device.id] || null;
  const connectedDevices = Object.values(devices).filter(d => d.connected);

  const getRssiColor = (rssi: number) => {
    if (rssi >= -50) return "text-green-500";
    if (rssi >= -70) return "text-yellow-500";
    return "text-red-500";
  };

  const getRssiStrength = (rssi: number) => {
    if (rssi >= -50) return "Strong";
    if (rssi >= -70) return "Good";
    return "Weak";
  };

  const getConnectionStatusIcon = () => {
    switch (device.connectionStatus) {
      case 'connected':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'lost':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'connecting':
        return <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />;
      case 'disconnecting':
        return <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />;
      case 'disconnected':
      default:
        return <XCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getConnectionStatusText = () => {
    switch (device.connectionStatus) {
      case 'connected':
        return "Connected";
      case 'lost':
        return "Connection Lost";
      case 'connecting':
        return "Connecting...";
      case 'disconnecting':
        return "Disconnecting...";
      case 'disconnected':
      default:
        return "Disconnected";
    }
  };

  const getConnectionStatusBadge = () => {
    switch (device.connectionStatus) {
      case 'connected':
        return <Badge variant="default">Connected</Badge>;
      case 'lost':
        return <Badge variant="destructive">Lost</Badge>;
      case 'connecting':
        return <Badge variant="secondary" className="animate-pulse">Connecting</Badge>;
      case 'disconnecting':
        return <Badge variant="secondary" className="animate-pulse">Disconnecting</Badge>;
      case 'disconnected':
      default:
        return <Badge variant="outline">Disconnected</Badge>;
    }
  };

  const handleConnect = async () => {
    await connect(device.id);
  };

  const handleDisconnect = async () => {
    await disconnect(device.id);
  };

  const isActionDisabled = device.connectionStatus === 'connecting' || device.connectionStatus === 'disconnecting';
  const [expanded, setExpanded] = useState(!device.connected);

  // Auto-collapse when a device transitions to connected; expand when disconnected
  useEffect(() => {
    if (device.connected) setExpanded(false);
    else setExpanded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device.connected]);

  // If device is connected, show terminal console
  if (device.connected) {
    return (
      <div className="h-full flex flex-col">
        {/* Compact one-line summary bar with expand toggle */}
        <div className="px-3 py-2 border-b flex items-center gap-3 text-sm">
          {getConnectionStatusIcon()}
          <span className="font-medium truncate">{device.name}</span>
          <span className="font-mono text-xs text-muted-foreground truncate">{device.address}</span>
          <span className={`ml-auto text-xs ${getRssiColor(device.rssi)}`}>
            {device.rssi} dBm ({getRssiStrength(device.rssi)})
          </span>
          <span className="ml-2">{getConnectionStatusBadge()}</span>
          <Button onClick={handleDisconnect} disabled={isActionDisabled} variant="destructive" size="sm">
            <WifiOff className="h-4 w-4 mr-1" />
            Disconnect
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? 'Collapse details' : 'Expand details'}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>

        {/* Expanded info (connected) */}
        {expanded && (
          <div className="px-3 py-2 border-b text-sm">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex items-center gap-2">
                <Signal className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className={`text-xs`}>Signal</p>
                  <p className={`${getRssiColor(device.rssi)}`}>{device.rssi} dBm ({getRssiStrength(device.rssi)})</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4">{getConnectionStatusIcon()}</div>
                <div>
                  <p className="text-xs">Status</p>
                  <p className="text-muted-foreground">{getConnectionStatusText()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-xs">Connected</p>
                  <p className="text-muted-foreground">{connection?.connectedAt?.toLocaleTimeString()}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Terminal Console */}
        <div className="flex-1 min-h-0 p-3">
          <TerminalConsole deviceId={device.id} />
        </div>
      </div>
    );
  }

  // If device is not connected, show a large centered card
  return (
    <div className="h-full flex items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl">{device.name}</CardTitle>
              <CardDescription className="font-mono text-sm">{device.address}</CardDescription>
            </div>
            {getConnectionStatusIcon()}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Signal className="h-4 w-4 text-muted-foreground" />
              <span className={getRssiColor(device.rssi)}>
                {device.rssi} dBm ({getRssiStrength(device.rssi)})
              </span>
            </div>
            {getConnectionStatusBadge()}
          </div>
          <div className="flex justify-center">
            <Button onClick={handleConnect} disabled={isActionDisabled} size="lg" className="w-48">
              <Wifi className="h-5 w-5 mr-2" />
              {device.connectionStatus === 'connecting' ? 'Connecting…' : 'Connect'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
