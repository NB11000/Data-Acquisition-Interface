# Implementation Plan: 多服务器 MQTT 连接架构

> **Parent**: [PRD](./PRD.md)
> **Date**: 2026-05-30

## Modules

| # | Module | File | Responsibility |
|---|--------|------|----------------|
| M1 | **MqttClientLike** | `src/mqtt/mqttClientLike.ts` | MQTT client abstraction interface — connect/subscribe/unsubscribe/publish/end/isConnected/events |
| M2 | **MockMqttClient** | `src/mqtt/mockClient.ts` | Mock client with internal topic router; mimics real MQTT subscribe/publish dispatch |
| M3 | **ConnectionPool** | `src/mqtt/connectionPool.ts` | Multi-connection lifecycle: create/destroy/update per serverId; state machine; online client cache; auto-reconnect |
| M4 | **ConnectionFactory** | `src/mqtt/connectionFactory.ts` | Factory interface + Mock/Real implementations; selected at App entry by VITE_MQTT_MODE |
| M5 | **Router** | `src/mqtt/router.ts` | Per-connection message dispatch: RPC first, then domain topics; serverId closure binding |
| M6 | **RPC Engine** | `src/mqtt/rpc.ts` | MachineId→serverId route resolution; correlation ID matching; timeout; connection-loss rejection |
| M7 | **Topics** | `src/mqtt/topics.ts` | Topic path builders (no change from current) |
| M8 | **Types** | `src/mqtt/types.ts` | Shared types: DeviceInfo, CommandResult, etc. |
| M9 | **serverStore** | `src/stores/serverStore.ts` | Zustand store: MqttServer[] CRUD with persist middleware + isConnected runtime state |
| M10 | **deviceStore** | `src/stores/deviceStore.ts` | Zustand store: Device[] CRUD with persist + selectedId + searchText |
| M11 | **Migration** | `src/mqtt/migration.ts` | Old-format localStorage detection → auto-transform → write new keys → delete old keys |
| M12 | **useMqttConnect** | `src/hooks/useMqttConnect.ts` | React hook: pool init, device switching with following-topic management, connection status binding |
| M13 | **AddDeviceModal** | `src/components/modals/AddDeviceModal.tsx` | Combined modal: server selector, auto-discover tab, manual-add tab, zero-server guidance |
| M14 | **MqttServerModal** | `src/components/modals/MqttServerModal.tsx` | Add/edit server form with test-connection button |
| M15 | **Settings Page** | `src/pages/Settings/index.tsx` | Server list (5 status states) + device table with CRUD |
| M16 | **Sidebar** | `src/components/sidebar/index.tsx` | Device tree grouped by server; expand/collapse; search; online status icons |

## Interfaces

### ConnectionPool ↔ ConnectionFactory

```
ConnectionFactory.createConnection(server: MqttServer): MqttClientLike
ConnectionFactory.destroyConnection(client: MqttClientLike): void
```

### ConnectionPool public API

```
ConnectionPool.create(server: MqttServer): void
ConnectionPool.destroy(serverId: string): void
ConnectionPool.update(server: MqttServer): void
ConnectionPool.getState(serverId: string): ConnectionState
ConnectionPool.getOnlineClients(serverId: string): Set<string>
ConnectionPool.publish(serverId: string, topic: string, payload: Uint8Array | string): void
ConnectionPool.subscribeDevice(serverId: string, machineId: string): void
ConnectionPool.unsubscribeDevice(serverId: string, machineId: string): void
ConnectionPool.switchFollowing(serverId: string, machineId: string): void
ConnectionPool.onMessage: EventEmitter<{serverId, topic, payload}>
ConnectionPool.onStateChange: EventEmitter<{serverId, state, error?}>
```

### RPC Engine public API

```
sendRpcCommand(machineId: string, method: string, payload?: object): Promise<CommandResult>
// Internal: resolves serverId via deviceStore, gets client from pool, publishes
// Internal: connection loss → immediate reject with CONNECTION_LOST
```

### Router

```
setupRouter(pool: ConnectionPool): void
// Registers onMessage handler per connection with serverId binding
// Dispatch order: tryResolveRpc → domain handlers (state, alarm, will, data)
```

### serverStore public API (Zustand)

```
useServerStore(): {
  servers: MqttServer[],
  addServer: (server: Omit<MqttServer, 'id' | 'isConnected'>) => string,
  removeServer: (id: string) => void,
  updateServer: (id: string, partial: Partial<MqttServer>) => void,
  setConnected: (id: string, connected: boolean | null) => void,
  findDuplicate: (brokerUrl: string, port: number, username: string) => MqttServer | undefined,
}
```

### deviceStore public API (Zustand)

```
useDeviceStore(): {
  devices: Device[],
  selectedId: string | null,
  searchText: string,
  addDevice: (device: Device) => void,
  removeDevice: (id: string) => void,
  setSelected: (id: string) => void,
  setOnline: (id: string, online: boolean) => void,
  setSearch: (text: string) => void,
  getDevicesByServer: (serverId: string) => Device[],
  getFilteredDevices: () => { server: MqttServer, devices: Device[] }[],
}
```

### Migration

```
runMigration(): boolean
// Returns true if migration was executed
// Checks localStorage for old-format devices
// Transforms and writes new keys
// Returns false on subsequent calls (migration already done)
```

## Data Flow

### Happy path: user adds server, discovers devices, monitors

```
User fills MqttServerModal form → serverStore.addServer() → localStorage persists
→ ConnectionPool.create(server) → factory creates MqttClientLike → connect()
→ on connect: subscribe $SYS topics
→ User opens AddDeviceModal → selects server → auto-discover reads OnlineClientCache
→ User checks devices → deviceStore.addDevice() for each
→ ConnectionPool.subscribeDevice(serverId, machineId) → subscribe 4 device-level resident topics
→ $SYS connected events arrive → router dispatches → deviceStore.setOnline(id, true)
→ Sidebar re-renders with online indicator
```

### Error path: connection fails

```
ConnectionPool.create(server) → mqtt.connect() fails
→ stateMachine transitions to reconnecting (attempt 1/3)
→ 1s backoff → retry fails → 2s backoff → retry fails → 4s backoff → retry fails
→ stateMachine transitions to failed
→ ConnectionPool.onStateChange fires { serverId, state: 'failed', error: 'AUTH_REJECTED' }
→ serverStore.setConnected(id, null) → Settings card shows red dot + error text
→ All devices on this server: isOnline = null
```

### Edge case: device switch while target server reconnecting

```
User selects Device B on Server Beta → Beta is in reconnecting state
→ useMqttConnect: subscribeDevice(B) → ConnectionPool checks state → connection not alive
→ Subscriptions queued → Beta reconnects → re-subscribe resident topics (NOT following topics)
→ useMqttConnect detects Beta connected → calls switchFollowing(Beta, B.id)
```

### Edge case: page refresh with stale cache

```
Page loads → localStorage contains mqttServers=[Alpha, Beta], devices=[A,B,C]
→ Migration.runMigration() → detects no old data → returns false
→ ConnectionPool.create(Alpha) + ConnectionPool.create(Beta) in parallel
→ $SYS events start populating OnlineClientCache
→ Sidebar renders immediately with isOnline=null for all devices
→ As $SYS events arrive, OnlineClientCache and deviceStore.isOnline update
```

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| Connection pool key | `serverId` (UUID) | User explicitly groups devices; avoids fragile hashing on brokerUrl:port:username |
| Same-server credentials | Shared by all devices | Simplifies mental model; cross-account deferred |
| Mock/Real separation | Dependency injection via factory | Eliminates `if (MQTT_MODE)` branches scattered through codebase |
| Auto-reconnect | 3 attempts, exponential backoff (1s/2s/4s) | Balances recovery with not endlessly retrying broken configs |
| Empty server | Disconnect on last device removal | Saves resources; reconnect cost is small (~1s TLS handshake) |
| Browser close | No explicit disconnect | Broker keepalive handles cleanup; beforeunload is unreliable |
| $SYS event routing | ServerId closure binding per connection onMessage | Avoids ambiguous device ownership when servers share device IDs |
| Migration | Auto on first load, one-shot | Users shouldn't need to manually migrate localStorage |
| RPC connection-loss | Immediate reject | 10s timeout is poor UX when we know the connection is gone |
| Search | Cross-server with auto-expand | Users think in device names, not server topology |
| Server dedup | Reject on save | Silently merging would hide user mistakes |

## Test Strategy

| Module | Type | Focus areas | What NOT to test |
|--------|------|-------------|------------------|
| **ConnectionPool** | Unit (Vitest) | create/destroy cycle, state transitions, auto-reconnect timer sequence, empty-server disconnect, subscribeDevice increments, OnlineClientCache add/remove | Actual mqtt.js connection behavior |
| **MockMqttClient** | Unit (Vitest) | Subscribe registers handler, unsubscribe removes, publish dispatches to matching handlers, wildcard topic matching, end() cleans up, force end | — |
| **RPC Engine** | Unit (Vitest) | MachineId→serverId resolution, correlation ID generation, response matching, 10s timeout, reject on connection-loss state check, mock mode dispatch | Network-level MQTT publish |
| **Migration** | Unit (Vitest) | Old format detection, unique broker extraction, Device field transformation, idempotency (second run is no-op), empty input, corrupted input | localStorage I/O (mocked) |
| **Router** | Unit (Vitest) | RPC response intercepted first, domain handler dispatch order, serverId propagated in message context, unknown topic handling | Actual topic content parsing |

### Test infrastructure

- **Runner**: Vitest (included with Vite project)
- **Mocking**: Manual test doubles (no heavy mocking framework); dependency injection makes this natural
- **Location**: Test files adjacent to source: `src/mqtt/connectionPool.test.ts`, `src/mqtt/mockClient.test.ts`, etc.

## Vertical Slice Design

### Slice 1: Data Model + Stores + Migration (Foundation)

**Dependencies**: None — first slice, no upstream

**Modules**: M8 (Types), M9 (serverStore), M10 (deviceStore), M11 (Migration), M7 (Topics)

**What this enables**: Data layer complete. All other slices can read/write MqttServer and Device. Old user data migrated on first load.

**Verification**: Open browser DevTools → localStorage contains `mqttServers` and `devices` keys. Old-format data auto-migrated.

---

### Slice 2: Connection Pool Core + DI

**Dependencies**: Slice 1

**Modules**: M1 (MqttClientLike), M2 (MockMqttClient), M3 (ConnectionPool), M4 (ConnectionFactory)

**What this enables**: Multi-connection infrastructure operational in both Mock and Real modes. All connection lifecycle management works.

**Verification**: In Mock mode, create a server → connection pool creates MockMqttClient → OnlineClientCache populates. Destroy server → connection released.

**Tests**: ConnectionPool unit tests, MockMqttClient unit tests

---

### Slice 3: Router + RPC

**Dependencies**: Slice 2

**Modules**: M5 (Router), M6 (RPC Engine)

**What this enables**: Messages routed to correct handlers per server. RPC commands sent to correct server/device. Connection-loss immediate rejection.

**Verification**: In Mock mode, send RPC to device on Server A → MockMqttClient of Server A receives publish. Disconnect Server A → subsequent RPC immediately rejects with CONNECTION_LOST.

**Tests**: RPC Engine unit tests, Router unit tests

---

### Slice 4: Add Device Flow

**Dependencies**: Slice 2, Slice 3

**Modules**: M13 (AddDeviceModal), M14 (MqttServerModal)

**What this enables**: Complete user journey for adding MQTT servers and discovering/adding devices. Zero-server guidance flow.

**Verification**: Open "Add Device" → no servers → auto-shows server form → save server → back to add-device → auto-discover shows online devices → check and add. Manual add with ID + name works.

---

### Slice 5: Settings Page

**Dependencies**: Slice 2

**Modules**: M15 (Settings Page)

**What this enables**: Centralized server management with 5 connection states and device list with CRUD.

**Verification**: Settings page shows all servers with connection status. Edit name → no reconnect. Edit broker URL → confirm dialog → reconnect. Delete server → confirm dialog shows affected devices.

---

### Slice 6: Sidebar + Device Switching

**Dependencies**: Slice 5

**Modules**: M16 (Sidebar), M12 (useMqttConnect)

**What this enables**: Device tree grouped by server. Search across servers. Select device → following topics swap. Cross-server switch keeps old connection alive.

**Verification**: Sidebar shows servers with expandable device lists. Search "daq-01" → matching server expands. Click device on different server → topic swap, old connection stays alive.

---

### Slice 7: Online Status Monitoring

**Dependencies**: Slice 6

**Modules**: M5 (Router — $SYS handling), M3 (ConnectionPool — OnlineClientCache)

**What this enables**: Real-time device online/offline in sidebar. Online Client Cache for auto-discovery. $SYS events correctly attributed per server.

**Verification**: MockMqttClient simulates $SYS connected → sidebar device icon turns green. Simulate $SYS disconnected → icon turns grey. Disconnect server → all devices on that server show "unknown."

---

### Slice 8: Environment Cleanup

**Dependencies**: Slice 1 (all env-dependent code already migrated)

**Modules**: `.env` file, import references

**What this enables**: Removes dead env vars; only VITE_MQTT_MODE remains.

**Verification**: `grep` for VITE_BROKER_URL in src/ returns zero results.

---

### Slice 9: Migration Unit Tests

**Dependencies**: Slice 1

**Modules**: M11 (Migration tests)

**What this enables**: Confidence that existing user data is not lost during upgrade.

**Tests**: Migration unit tests
