## Action Plan to Improve UI Responsiveness During BLE Scanning

### Goals
- Keep the renderer thread responsive while scans run.
- Minimize state churn and re-render work during scanning.
- Preserve current features and event semantics.

### 1) Move scanning off the renderer (preload) into the Electron main process
- Implement the BLE client in the main process (Node context) and expose a minimal IPC bridge to the preload/renderer.
- Aggregate device discovery events in the main process and emit coalesced batches (e.g., every 250–500ms) to the renderer, not per-device.
- Keep detailed native device references in the main process to avoid passing large objects over the bridge; send only lean DTOs: `{ id, name, address, rssi }`.

Deliverables:
- New main-process BLE module and event emitter.
- IPC channel handlers: `scanStatus`, `devicesDiscovered`, `deviceUpdated`, `connectionChanged`, `characteristicValue`.
- Preload relay updated to subscribe to main IPC and expose the same `bleAPI` surface.

### 2) Defer per-device storage reads during active scan
- In `ble-store.ts`, remove calling `hydrateDeviceSettings` inside the discovery flush during scan.
- Instead, only hydrate settings:
  - On first selection of a device; or
  - On connect; or
  - After the scan completes (single pass through the discovered set).

Deliverables:
- Gate `hydrateDeviceSettings` behind `scanStatus !== 'scanning'` or invoke it from `SCAN_COMPLETED` for the visible devices (top N) or lazily on interaction.

### 3) Reduce dev-mode overhead during scan
- Disable Zustand `devtools` when `scanStatus === 'scanning'` (conditional dispatch wrapper), or disable devtools entirely in development builds when troubleshooting performance.
- Optionally pause action history appends during scanning.

Deliverables:
- Guarded `dispatch` that skips devtools/actionHistory recording when scanning.

### 4) Virtualize the device list
- Replace the current full render loop with a windowed list (e.g., `react-virtual` or equivalent), while continuing to use shadcn/ui components for row contents.
- Keep row height predictable to simplify virtualization.

Deliverables:
- `DeviceList` updated to virtualize rows and only render visible items.

### 5) Narrow store subscriptions and reuse store-side selectors
- In `DeviceList`, subscribe to derived, memoized selectors (`getSortedFilteredDevices`) rather than sorting in the component.
- Use selectors that return stable references to avoid unnecessary re-renders; consider `zustand` selectors with shallow equality.

Deliverables:
- Component updated to consume `getSortedFilteredDevices()` and avoid referencing raw `devices` to prevent identity changes from re-rendering the whole list.

### 6) Throttle UI updates during scan
- Keep the existing 1s batch in the store, but make it adaptive: shorter (250–500ms) when device count is small, longer (1000–1500ms) when many devices are being discovered.
- Alternatively, keep a constant 500ms batch and cap the number of new items processed per batch to a fixed budget.

Deliverables:
- Update `scheduleFlush` in `ble-store.ts` to a configurable throttle.

### 7) Lightweight rows and memoization
- Memoize heavy subcomponents (e.g., status dot, connection badge) and avoid creating inline functions/objects where possible.
- Precompute device display fields in selectors (e.g., derived `displayName`, `rssiCategory`) to reduce per-render work.

Deliverables:
- Minor `DeviceList` refactor: stable callbacks, classNames, and memoized subviews.

### 8) Optional: Progress UI and post-scan work
- Show a progress indicator based on `scanStatus` and discovered count without forcing full list re-sorts.
- After `SCAN_COMPLETED`, optionally pre-sort once and then mark list as static until the next scan to reduce re-sorts.

Deliverables:
- Minor UI change to decouple progress from list rendering during scan.

### Suggested implementation order
1. Move scanning to Electron main and batch events at the source.
2. Defer settings hydration to post-scan / on-interaction.
3. Virtualize `DeviceList` and switch to store-side sorted selector.
4. Add throttled flush and narrow subscriptions.
5. Optimize devtools/action history in dev mode and memoize rows.

### Acceptance criteria
- Starting a scan does not freeze typing in the search input, and scrolling the list remains smooth (>55 FPS) with 100+ devices.
- CPU usage on the renderer stays within reasonable bounds during scanning.
- No loss of functionality: device discovery, connect, subscribe, and console features work as before.


