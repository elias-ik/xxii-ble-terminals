## Slow UI During BLE Scanning — Root Cause Analysis

### Executive summary
During BLE scans, the renderer becomes busy due to a combination of: scanning work occurring in the renderer/preload context, bursty state updates, unnecessary per-device storage I/O, and rendering a non-virtualized list with relatively heavy per-row components. These factors compound and cause visible jank and input latency.

### Current architecture (relevant parts)
- BLE events are produced by a client loaded in the Electron preload and exposed to the renderer as `window.bleAPI`.
- The renderer binds those events in the Zustand store (`app/lib/ble-store.ts`), batches discovered devices, and updates UI state.
- The device list UI renders all devices (no virtualization) and does per-render sorting and various UI adornments.

Key code locations:

```121:190:app/lib/ble/webbluetooth-client.ts
export const webBluetoothClient: BLEClient = {
  on: (e, h) => emitter.on(e, h as any),
  off: (e, h) => emitter.off(e, h as any),
  async scan() {
    try {
      emitter.emit('scanStatus', { status: 'scanning' });
      const Bluetooth = await getBluetoothCtor();
      // ... loop calling requestDevice() and emitting deviceDiscovered
      emitter.emit('scanStatus', { status: 'completed', deviceCount: seen.size });
    } catch (error: any) {
      emitter.emit('scanStatus', { status: 'failed', error: String(error?.message || error) });
    }
  },
  // ...
};
```

```739:807:app/lib/ble-store.ts
export const useBLEStore = create<BLEState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ...
      setupEventListeners: () => {
        const pendingDiscoveries: Record<string, Device> = {};
        let flushTimer: number | null = null;
        const flushNow = () => {
          // Dispatch DEVICES_DISCOVERED in batches
          const arr = Object.values(pendingDiscoveries);
          if (arr.length > 0) {
            dispatch({ type: 'DEVICES_DISCOVERED', payload: arr });
            arr.forEach((d) => get().hydrateDeviceSettings(d.id).catch(() => {}));
            // ...
          }
        };
        // ... bind bleAPI event listeners
      },
      // ...
    }))
  )
);
```

```16:61:app/components/device-list.tsx
export function DeviceList({ onDeviceSelect, selectedDevice }: DeviceListProps) {
  const {
    getFilteredDevices,
    searchQuery,
    setSearchQuery,
    // ...
    devices,
  } = useBLEStore();

  const filteredDevices = getFilteredDevices();
  const sortedDevices = useMemo(() => [...filteredDevices].sort(/* ... */), [filteredDevices]);
  // ... render ALL rows in a ScrollArea (no virtualization)
}
```

### Findings
1) Scanning runs in the renderer process (via preload)
- The `webbluetooth-client.ts` is imported from preload (`preload.mjs`), not the main process. Preload shares the renderer’s event loop, so any CPU-bound work or high-frequency event emission there contends with UI rendering.
- The scan implementation loops, repeatedly constructing a `Bluetooth` instance and calling `requestDevice` in bursts. While asynchronous, it produces many events and work on the renderer side.

2) Event burst → state churn in renderer (extra storage I/O per device)
- Even though device discoveries are batched to 1 second in the store, after each batch the store calls `hydrateDeviceSettings` for every newly discovered device. That triggers IPC-backed storage `get` calls and potential `DEVICE_SETTINGS_UPDATED` dispatches per device during the scan window, further increasing render frequency and GC pressure.

3) Dev-mode middleware overhead amplifies costs
- Zustand `devtools` is enabled in development. Each state change can be serialized and sent to the devtools bridge, which is expensive for larger objects and frequent updates.
- An action history is maintained (last 100), still adding allocations each dispatch.

4) Non-virtualized rendering of device list with relatively heavy row content
- The list renders all devices with nested components (e.g., `HoverCard`) and dynamic calculations. With dozens/hundreds of devices, reconciliation and layout become costly.
- Additional per-row work: sorting the full array in the component, RSSI categorization, color calculation, truncation, accessible label composition, and inline styles.

5) Broad store selection triggers re-renders
- `DeviceList` selects `devices`, `getFilteredDevices`, `searchQuery`, etc., without a selector/shallow compare. Any change to `devices` (object identity) triggers a re-render and re-sort of the full list.

6) Superfluous or duplicate work
- Sorting happens in the component despite the store providing `getSortedFilteredDevices` with a simple identity cache. This duplicates CPU work and reduces caching benefits.

7) Preload → Renderer event bridging overhead
- For each discovered device, a bridge handler is invoked, then the renderer schedules/batches. It’s manageable, but keeping the high-frequency source in the renderer path still adds pressure compared to coalescing updates in the main process.

### Impact assessment (qualitative)
- Renderer thread contention: High
- State update frequency during scan: Medium→High (batched, but followed by many per-device storage calls)
- Rendering cost: Medium (could be High with large device counts)
- Devtools overhead: Medium in dev, negligible in production (unless devtools left enabled)

### Why this manifests as “slow UI”
- The renderer’s main thread juggles: receiving bursts of discovery events, merging device maps, running per-device storage lookups and dispatches, and fully re-rendering a complex, non-virtualized list. Combined, this causes frame drops and input lag during active scanning.

### Risks/unknowns
- webbluetooth polyfill behavior in Electron may vary across platforms; if it performs extra synchronous work, moving it off the renderer becomes even more important.
- If many devices repeatedly flap or update RSSI, UI churn can be worse than observed here.

### Conclusion
The dominant factors are architectural: scanning in the renderer/preload and per-device storage + state churn during scans. Secondary factors are list rendering without virtualization and broad store subscription patterns. Addressing the architecture and throttling/deferring secondary work will materially improve UI responsiveness during scans.


