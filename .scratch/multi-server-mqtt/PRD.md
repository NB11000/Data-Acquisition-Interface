# PRD: 多服务器 MQTT 连接架构

> **状态**: needs-triage
> **日期**: 2026-05-30

## Problem Statement

当前前端只支持单一 MQTT Broker 连接（全局 env 变量配置），Device 虽然存储了各自的 brokerUrl/port/username/password，但这些字段从未被使用。当用户需要管理分布在多个 MQTT Broker 上的设备时，只能硬编码一个 Broker，无法切换。此外，每次添加设备都需重复填写完整的连接参数，操作繁琐。

## Solution

引入显式 MqttServer 实体，前端为每个 MqttServer 维护一条独立 MQTT 连接。Device 简化为仅携带 id / name / serverId 引用。同服务器下的设备切换仅做主题切换复用连接，跨服务器切换保留旧连接。Mock 与 Real 模式通过依赖注入解耦。

## User Stories

1. As a user, I want to add an MQTT server with connection credentials (address, port, username, password, TLS), so that I can connect my frontend to a broker.
2. As a user, I want to test a server connection before saving, so that I can verify the credentials are correct.
3. As a user, I want to be warned when I try to add a server that duplicates an existing one (same address:port:username), so that I avoid wasting connections.
4. As a user, I want to edit a server's name without disconnecting, so that I can rename it without interrupting monitoring.
5. As a user, I want to edit a server's connection parameters, with a confirmation dialog warning me that devices may need to be removed if the broker address changed.
6. As a user, I want to delete a server and see which devices will be affected before confirming, so that I understand the impact of deletion.
7. As a user, I want to see all my servers and their connection status (connected/disconnected/reconnecting/failed) on the Settings page, so that I can manage my infrastructure at a glance.
8. As a user, I want connection failure details displayed on the server card (e.g., "authentication rejected" vs "broker unreachable"), so that I know how to fix the problem.
9. As a user, I want automatic reconnection (3 attempts, exponential backoff) when a server connection drops, so that transient network issues recover without my intervention.
10. As a user, I want a manual "Reconnect" button when auto-reconnect is exhausted, so that I can retry at my convenience.
11. As a user, I want to add devices to a server by auto-discovering online devices through MQTT $SYS topics, so that I don't need to type IDs for every device.
12. As a user, I want to manually add a device by entering its ID and name, so that I can register offline devices or devices with non-standard IDs.
13. As a user, I want the add-device flow to guide me to add a server first if none exist, so that I never reach a dead end.
14. As a user, I want my server and device configurations to persist across page refreshes via localStorage, so that my setup is preserved.
15. As a user, I want existing devices (from the old single-broker architecture) to be automatically migrated to the new server-based model on first load, so that I don't lose data during upgrade.
16. As a user, I want to see all my devices grouped by their server in the sidebar, with each server node expandable/collapsable, so that I understand the server-device relationship.
17. As a user, I want real-time online/offline status for every device displayed in the sidebar, so that I know which nodes are operational without checking each one.
18. As a user, I want devices on a disconnected server to show "unknown" status (not "offline"), so that I can distinguish "maybe working" from "definitely down."
19. As a user, I want to search devices across all servers in the sidebar, with matching results highlighted and their server groups auto-expanded, so that I can quickly find a specific device.
20. As a user, I want to switch between devices on the same server instantly (topic swap only), so that my workflow is not interrupted by reconnection delays.
21. As a user, I want the previous server's connection to stay alive when I switch to a device on a different server, so that all devices continue to be monitored for online/offline events.
22. As a user, I want RPC commands to reach the correct device regardless of which server it's on, so that I can control all devices from a single interface.
23. As a user, I want an immediate error message when I try to send an RPC command but the target server is disconnected, so that I don't wait for a timeout.
24. As a user, I want the dashboard to keep displaying the last known data when the active server connection drops, with a translucent banner indicating the connection status, so that I can still reference recent data during outages.
25. As a user, I want the system to work identically in Mock mode (for local testing/development) without any mock-specific code leaking into the real mode logic.

## Implementation Decisions

### Architecture

- **MqttServer is an explicit entity**: replaces the ADR 0001 "per-device config" approach. ADR 0003 provides full rationale.
- **Connection pool key = serverId**: simpler than the previous `brokerUrl:port:username:password` hashing. User decides groupings explicitly.
- **Same-server devices share credentials**: one MQTT account manages all devices on a server. Cross-account scenarios deferred — would use a dedicated ACL account for the frontend.
- **Mock/Real dependency injection**: `MqttClientLike` interface with separate Mock and Real implementations. App entry point injects based on `VITE_MQTT_MODE`. ADR 0004 provides full rationale.

### Data Model

- **MqttServer**: `{ id, name, brokerUrl, port, username, password, tls, caCert?, isConnected }`. CaCert stored as PEM string in localStorage.
- **Device**: `{ id (MachineId), name, serverId, isOnline }`. No connection config. serverId references MqttServer.id.
- **Persistence**: Two localStorage keys — `mqttServers` (MqttServer[]) and `devices` (Device[]).

### Connection Lifecycle

- **Init**: parallel server connections, UI renders immediately, per-server status cards update as connections establish/fail.
- **Shutdown**: no explicit disconnect — Broker keepalive timeout handles cleanup.
- **Auto-reconnect**: 1s → 2s → 4s, 3 attempts max. On exhaustion, server enters "failed" state with manual retry button.
- **Empty server (0 devices)**: connection is closed to release resources. Re-created when first device is added.

### Topic Subscriptions

- **Server-level resident**: $SYS connected/disconnected — subscribed once per server connection.
- **Device-level resident**: will, state_changed, device_alarm, RPC response wildcard — added/removed per-device.
- **Following**: waveform/ch1, waveform/ch2, lowfreq, detection/alerts — swapped on device selection change.
- **Reconnect recovery**: only resident topics are re-subscribed, not following topics.

### Online Status Monitoring

- Each connection's onMessage closure captures its serverId. $SYS events update only that server's devices.
- Online Client Cache (`serverId → Set<clientId>`) maintained from $SYS events, used for auto-discovery modal.

### RPC Routing

- `sendRpcCommand(machineId, method)` internally looks up `deviceMap[machineId] → serverId → connectionPool[serverId] → client.publish()`. Callers unaware of connection pool.
- Pending RPCs immediately reject on connection loss (no 10-second wait).

### UI

- **Add Device Modal**: server selector dropdown + [Add New]; auto-discover tab + manual add tab; auto-switches to server creation form when server list is empty.
- **Server deduplication**: save-time check on `brokerUrl:port:username`.
- **Settings page**: server list (5 states: initializing/connected/disconnected/reconnecting/failed) + device table.
- **Sidebar**: tree grouped by server, search filters cross-server with auto-expand.

### Migration

- First-load auto-detection of old-format Device data (fields `brokerUrl`/`port`/`username`/`password` present).
- Extract unique broker configs → generate MqttServer entities → strip connection fields from Device → add serverId → write new keys → delete old key.

### Environment Variables

- Keep: `VITE_MQTT_MODE` (mock/real).
- Remove: `VITE_BROKER_URL`, `VITE_BROKER_USERNAME`, `VITE_BROKER_PASSWORD`, `VITE_DEFAULT_MACHINE_ID`.

## Testing Decisions

### What to test

Tests should verify **external behavior through public interfaces**, not internal implementation details.

| Module | Test Type | Focus |
|--------|-----------|-------|
| **ConnectionPool** | Unit | Lifecycle (create/destroy/update), state transitions, subscribe/unsubscribe dispatch, reconnect timer logic, empty-server disconnection |
| **MockMqttClient** | Unit | Topic router: subscribe/unsubscribe registration, publish dispatch, wildcard matching, force-end behavior |
| **RPC Engine** | Unit | MachineId→serverId routing, correlation ID matching, timeout resolution, immediate rejection on connection loss |
| **Migration** | Unit | Old→new format conversion, duplicate broker dedup, idempotency, empty/corrupted input handling |
| **Router** | Unit | Message dispatch ordering (RPC first, then domain topics), serverId binding in message context |

### What NOT to test

- UI components (add-device modal, settings page, sidebar) — these are integration-centric and change frequently. Manual verification during development is sufficient.
- Zustand store persistence (tested by the library).
- Real MqttClient adapter (wraps mqtt.js — testing TCP connections is beyond unit test scope).

### Prior art

No existing test infrastructure in this codebase. Tests will be written using Vitest (bundled with the Vite project). Test files adjacent to source: `connectionPool.test.ts`, `mockClient.test.ts`, etc.

## Out of Scope

- Cross-account ACL scenarios (different devices on same broker requiring different MQTT credentials) — deferred until explicitly needed.
- EMQX HTTP API integration for device discovery — staying MQTT-native.
- Device grouping beyond server (e.g., tags, folders, projects).
- Multi-user support or shared server configurations.
- Server connection health metrics or logging dashboard.
- WebSocket transport fallback (keep mqtt.js default).

## Further Notes

- This spec supersedes the existing `.scratch/mqtt-connection-pool/` feature branch. The ADR 0002 pool concept is retained but keying and lifecycle details are refined per this PRD.
- The `frontend-perf` skill should be consulted during dashboard implementation to ensure waveform rendering doesn't degrade with multiple active connections.
- TLS CA certificate upload flow should accept `.crt` and `.pem` files, read as text, store the PEM content directly in localStorage.
