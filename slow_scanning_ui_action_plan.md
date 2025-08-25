## Slow UI during scanning – action plan

Objective: Keep the UI responsive while scanning, focusing on the device list.

### Priority 1: Reduce render churn in the device list
1) Virtualize the device list
   - Replace direct `sortedDevices.map` with a virtualized list (e.g., TanStack Virtual). Only render visible rows.
   - Extract a memoized `DeviceRow` with stable primitive props to avoid re-renders.

2) Use selectors with referential stability
   - In the store, expose memoized selectors that return stable array references when inputs are unchanged: `selectSortedFilteredDevices(searchQuery)`.
   - In `DeviceList`, subscribe only to needed slices via selector functions to avoid unrelated updates.

3) Memoize derived helpers
   - Cache `statusColors`, `categorizeRssi`, truncation results where possible using `useMemo` based on row props.
   - Hoist static style objects; avoid inline object/array creations in render.

### Priority 2: Throttle and batch device discovery
4) Time-sliced batching in the store
   - Accumulate discoveries into `pendingDiscoveries` and flush at a fixed cadence (e.g., every 100–150ms) via `requestAnimationFrame` or `setTimeout`.
   - Avoid emitting more than ~10–20 batches per second.

5) Coalesce updates
   - When a device updates multiple times within a window, only keep the latest copy for the next flush to minimize list updates.

### Priority 3: Avoid unnecessary work during scans
6) Skip heavy derivations when scanning
   - If scanning, defer non-critical enrichment (e.g., extended metadata) until scan completes or device is selected.

7) Dev-mode optimizations
   - Ensure action history and verbose logging are disabled during scanning in development to prevent overhead.

### Priority 4: UX smoothing
8) Progress indicators without frequent re-layouts
   - Keep a simple scanning indicator that does not trigger layout (e.g., CSS animation) rather than state-driven spinners for each row.

9) Optional: Idle precomputation
   - Use `requestIdleCallback` to precompute expensive string truncations or tooltip contents for offscreen rows.

### Acceptance criteria
- Smooth typing and scrolling while scanning with 100+ advertisers.
- Device list stays responsive; only visible rows render.
- No noticeable jank from batch flushes.

### Rollout plan
1) Introduce `VirtualDeviceList` and `DeviceRow` (memoized) and integrate into `DeviceList`.
2) Add time-sliced batching to the store discovery flush mechanism.
3) Add stable selectors for sorted/filtered devices and adopt them in `DeviceList`.
4) Audit and memoize per-row derived helpers; hoist constants.


