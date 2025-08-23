## BLE Architecture (Renderer ⇄ Preload ⇄ Client)

### Overview
The app uses a layered BLE architecture to keep the UI decoupled from the BLE implementation. The renderer (React) never imports the BLE client directly. Instead, it talks to a stable `window.bleAPI` surface provided by `preload.js`, which internally imports the shared `app/lib/ble/client.ts`. Today that client is backed by a mock; later it can be swapped for a real BLE library without UI changes.

Layers:
- UI (React components) → Zustand store (`app/lib/ble-store.ts`)
- Renderer ↔ Preload via `window.bleAPI` (context bridge)
- Preload → BLE Client (`app/lib/ble/client.ts`) → current impl (`mock-client.ts`)

---

### UI Layer
Key components call the store’s high-level actions; they never access BLE directly:
- `app/components/device-list.tsx`: scanning, selecting device(s)
- `app/components/device-details.tsx`: connect/disconnect logic, console surface
- `app/components/terminal-console-simple.tsx`: read/write, subscribe/unsubscribe, message rendering

All of the above import the Zustand store:
- `app/lib/ble-store.ts` exposes actions like `scan`, `connect`, `disconnect`, `read`, `write`, `subscribe`, `unsubscribe` and wires event listeners in `setupEventListeners()`.

---

### Renderer Store (Zustand)
File: `app/lib/ble-store.ts`

Responsibilities:
- Global state: devices, connections, console buffers (per device), per-device UI (`deviceUI`), settings, UI persistence.
- Action dispatchers and reducers (pure updates) to keep logic predictable.
- Event wiring to `window.bleAPI`. The store subscribes to BLE events and normalizes them into store actions.

Important details:
- All BLE calls are routed through `window.bleAPI` (exposed by preload), not through direct imports.
- `setupEventListeners()` binds:
  - `onScanStatus` → SCAN_STARTED/SCAN_COMPLETED/SCAN_FAILED
  - `onDeviceDiscovered`/`onDeviceUpdated`
  - `onConnectionChanged` → CONNECTION_*
  - `onCharacteristicValue` → console buffer + CHARACTERISTIC_VALUE_RECEIVED
- Sending (HEX/UTF8):
  - `formatDataForSend()` validates/normalizes input
  - HEX input is converted to raw bytes via `hexStringToBytes()` for the console’s raw storage
  - The console renders bytes according to the selected display format (HEX/UTF8/ASCII)
- Conditional auto-scroll: console only scrolls if user is at bottom (Radix viewport listener)
- Gating writes: send is disabled unless a write/writeNoResp target is actively selected

---

### Preload Bridge
File: `preload.js`

What it does:
- Enables TypeScript in preload via `ts-node/register/transpile-only`
- Imports the shared BLE client from `app/lib/ble/client.ts`
- Exposes a stable `window.bleAPI` API that the renderer uses
- Relays BLE client events to the renderer and supports removal of handlers where possible

Exposed methods:
- `scan()`, `connect(deviceId)`, `disconnect(deviceId)`, `read(deviceId, serviceId, characteristicId)`, `write(deviceId, serviceId, characteristicId, data)`, `subscribe(...)`, `unsubscribe(...)`
- Event subscriptions: `onScanStatus`, `onDeviceDiscovered`, `onDeviceUpdated`, `onConnectionChanged`, `onCharacteristicValue`
- Optional remove listener variants: `removeScanStatusListener`, `removeDeviceDiscoveredListener`, etc.

Event mapping:
- `scanStatus`: maps client’s `'scanning'|'completed'|'failed'` into renderer’s `'started'|'completed'|'failed'`
- `connectionChanged`: passes `{ deviceId, status, connection? }` (filters out transient `'connecting'/'disconnecting'`)
- `characteristicValue`: forwards payload, assigns `timestamp: new Date()`

---

### BLE Client (Shared)
File: `app/lib/ble/client.ts`

Interface `BLEClient`:
- Event API: `.on(event, handler)`, `.off(event, handler)` for events: `scanStatus`, `deviceDiscovered`, `deviceUpdated`, `connectionChanged`, `subscriptionChanged`, `characteristicValue`
- Ops: `scan`, `connect`, `disconnect`, `read`, `write`, `subscribe`, `unsubscribe`

Current implementation: `mock-client.ts`
- Emits realistic events and values (device discovery, services/characteristics, read/notify data)
- Write echo behavior:
  - If payload looks like hex, it’s decoded to printable ASCII and echoed as `Echo ...` (e.g., `41` → `Echo A`)
  - Otherwise echoes as-is prefixed with `Echo ...`
- Subscribe: periodic notifications emitted as `characteristicValue`

Swap path:
- To adopt a real BLE library later, implement `BLEClient` and change the import in `client.ts` to use the real impl. Preload and renderer remain unchanged.

---

### Data Flow
1) User triggers action in UI → store action (e.g., `scan()`)
2) Store calls `window.bleAPI.scan()`
3) Preload invokes `bleClient.scan()` (from `client.ts`)
4) Client emits `scanStatus` events → Preload relays → Store handles via reducers → UI updates

Reads/Writes:
- `write()` in store:
  - Prepares bytes (HEX → raw bytes; UTF8 → encoded)
  - Logs outbound console entry immediately
  - Calls `window.bleAPI.write()` → client impl
  - Echo/notify events from client flow back and are rendered according to display format

Subscriptions:
- `subscribe()` in store → `window.bleAPI.subscribe()` → client begins periodic notifications → events relayed back through preload → store → UI

---

### Renderer API Surface (window.bleAPI)
Guaranteed by preload:
- Methods: `scan`, `connect`, `disconnect`, `read`, `write`, `subscribe`, `unsubscribe`
- Events: `onScanStatus`, `onDeviceDiscovered`, `onDeviceUpdated`, `onConnectionChanged`, `onCharacteristicValue`
- Removal: `remove*Listener` when available

This is the sole dependency the renderer has on BLE, ensuring implementation swap is transparent to UI.

---

### Considerations & Next Steps
- Preload TS: current approach uses `ts-node/register/transpile-only`. For production builds, consider bundling a `preload.ts` to JS (e.g., via esbuild) to avoid runtime transpilation.
- Event parity: if the real BLE library offers different event semantics, adapt in client impl to keep the preload/renderer contract stable.
- Error mapping: consider normalizing error shapes in client so UI can display consistent error messages.
- Unsubscribe cleanup: ensure we remove all listeners on window unload/HMR to avoid leaks.
- SubscriptionChanged: store currently doesn’t consume a dedicated `subscriptionChanged` relay from preload; if needed, add mapping similar to other events.

---

### Minimal Sequence (Write/Echo example)
```
UI → store.write("device-1","svc","char","41")
store → formats (HEX → raw 0x41), logs outbound console entry
store → window.bleAPI.write(..., "41")
preload → bleClient.write(..., "41")
client(mock) → emits characteristicValue: "Echo A"
preload → relays event to renderer
store → adds inbound console entry (raw bytes from string), renders per display format
```


