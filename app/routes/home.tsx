import type { Route } from "./+types/home";
import { Button } from "../components/ui/button";
import { Bluetooth, RefreshCw, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useBLEStore, selectors } from "../lib/ble-store";
import { DeviceList } from "../components/device-list";
import { DeviceDetails } from "../components/device-details";
import { ClientOnly } from "../components/client-only";
import { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "XXII BLE Terminals" },
    { name: "description", content: "BLE Terminal Application" },
  ];
}

export default function Home() {
  return (
    <ClientOnly
      fallback={
        <div className="h-screen flex items-center justify-center bg-background">
          <div className="text-center">
            <Bluetooth className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Loading BLE Terminal...
            </h3>
            <p className="text-muted-foreground">
              Initializing Bluetooth functionality
            </p>
          </div>
        </div>
      }
    >
      <HomeContent />
    </ClientOnly>
  );
}

function HomeContent() {
  // Initialize keyboard shortcuts
  useKeyboardShortcuts();
  
  const {
    sidebarCollapsed,
    selectDevice,
    toggleSidebarCollapse,
    scan
  } = useBLEStore();

  // Derivations via selectors to ensure reactivity
  const selectedDevice = useBLEStore((state) => selectors.getSelectedDevice(state));
  const isScanning = useBLEStore((state) => selectors.getIsScanning(state));
  const scanStatus = useBLEStore((state) => state.scanStatus.status);
  const globalStatus = scanStatus === 'scanning' ? 'Scanning…' : (scanStatus === 'completed' ? 'Ready' : (scanStatus === 'failed' ? 'Scan failed' : 'Idle'));

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top App Bar */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSidebarCollapse(!sidebarCollapsed)}
              aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-6 w-6" /> : <PanelLeftClose className="h-6 w-6" />}
            </Button>
            <h1 className="text-xl font-semibold text-foreground">XXII BLE Terminals</h1>
            <div className="flex items-center gap-2">
              <Bluetooth className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{globalStatus}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Device List */}
        {!sidebarCollapsed && (
          <aside className="border-r bg-card flex flex-col shrink-0 w-[320px] min-w-[320px] max-w-[320px]">
            <div className="p-3 border-b">
              <h2 className="font-medium text-foreground">Devices</h2>
            </div>
            <div className="flex-1 flex flex-col min-h-0">
              <DeviceList
                onDeviceSelect={selectDevice}
                selectedDevice={selectedDevice}
              />
            </div>
          </aside>
        )}

        {/* Right Content Pane */}
        <div className="flex-1 flex flex-col">
          {selectedDevice ? (
            <DeviceDetails device={selectedDevice} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Bluetooth className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium text-foreground mb-2">
                  No Device Selected
                </h3>
                <p className="text-muted-foreground mb-4">
                  Select a device from the sidebar to view details and connect
                </p>
                <Button onClick={scan} disabled={isScanning}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
                  Scan for Devices
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
