## Slow UI during scanning – analysis

Scope: The UI becomes sluggish while scanning for BLE devices, most noticeable in the device list.

### Symptom
- Input interactions and general UI responsiveness degrade during active scans.
- Device list updates feel choppy; scrolling and typing lag.

### Likely root causes in current code
1) High-frequency store updates during scans
   - `ble-store.ts` wires `onDeviceDiscovered` and `onDevicesDiscovered`, accumulating into `pendingDiscoveries` and dispatching batches via `DEVICES_DISCOVERED`.
   - Even with batching, frequent dispatches can still occur, especially with many advertisers.
   - Each dispatch triggers subscribers across the app (e.g., device list), causing re-renders.

2) Broad subscriptions in UI components
   - `DeviceList` pulls multiple selectors: `getFilteredDevices`, `getSortedFilteredDevices`, `devices`, `searchQuery`, `getIsScanning`.
   - If any of these selectors or underlying references change per batch, the list re-renders entirely.

3) Sorting/filtering on every render
   - `getFilteredDevices` / `getSortedFilteredDevices` likely compute derived arrays. If not memoized per input identity (devices + query), this runs on each batch and allocates large arrays.

4) Large list rendering without virtualization
   - `DeviceList` maps over `sortedDevices` directly. With dozens/hundreds of devices, full list DOM updates occur per batch.
   - HoverCard wrappers and inline style objects per row increase work.

5) Action history and dev-mode overhead during scans
   - Code comments reference bypassing action history growth during scanning in development. If not fully disabled, logging/action history can add overhead.

6) Excessive formatting/derived values per row
   - Device display name truncation, RSSI categorization, status colors, accessibility labels run per row per render.
   - These are small individually but add up across N devices and M batches.

7) Main-thread contention from BLE events
   - In Electron/Web Bluetooth, event delivery and UI share the main thread. High-frequency JS handlers during scans will contend with rendering.

### Why device list is hit hardest
- It directly reflects scan results and re-renders on every batch.
- It currently renders the full list without windowing and computes several derived values per row.

### Observed code evidence (non-exhaustive)
- `app/components/device-list.tsx` renders full `sortedDevices.map(...)` without virtualization or memoized rows.
- `ble-store.ts` implements batched discovery but still may dispatch often. Selectors exist (`getIsScanning`, etc.), but the device arrays likely change identity frequently.

### Summary
Scanning floods the app with updates. Without strict memoization, selectors, and list virtualization, the device list repeatedly re-renders large trees and derived computations, causing visible lag across the UI.


