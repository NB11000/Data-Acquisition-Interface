# PRD: 删除 MqttServer.tls 字段，从 brokerUrl 推导传输协议

> **状态**: needs-triage
> **日期**: 2026-06-01

## Problem Statement

当前 MqttServer 数据模型中，传输协议（mqtt / mqtts）通过独立的布尔字段 `tls` 决定，brokerUrl 仅存储主机地址。这种分离设计导致两个问题：

1. **URL 拼接 bug**：`connectionFactory` 中 `const protocol = server.tls ? 'mqtts' : 'mqtt'` 与 `const url = \`${protocol}://${server.brokerUrl}:${server.port}/mqtt\`` 拼接时，如果用户粘贴了含前缀的 brokerUrl（如 `mqtts://host.com`），会拼出 `mqtts://mqtts://host.com:8883/mqtt` 的重复前缀。
2. **数据冗余**：brokerUrl 本就能承载协议信息，额外的 `tls` 字段是冗余的二义性来源。

## Solution

删除 `MqttServer` 接口中的 `tls: boolean` 字段。协议信息由 brokerUrl 的前缀自行携带：`mqtt://host` 表示非加密，`mqtts://host` 表示 TLS 加密。`connectionFactory` 不再推导协议，直接使用用户输入的完整 brokerUrl 拼接连接地址。

模态框中 TLS 开关变为纯 UI 控件：仅控制 CA 证书上传按钮的启用/禁用，不存入数据模型，其开关状态自动跟随 brokerUrl 前缀变化。

## User Stories

1. As a user, I want to paste an MQTT broker URL with its protocol prefix (e.g., `mqtts://emqx.example.cn`) directly into the form, so that I don't get a double-prefix connection error.
2. As a user, I want the form to enforce that I include the protocol prefix in the broker address, so that the connection URL is always well-formed.
3. As a user, I want a TLS indicator in the server form that automatically reflects whether my broker URL uses TLS, so that I can verify the encryption status without parsing the URL manually.
4. As a user, I want the CA certificate upload to be available only when my broker URL indicates TLS, so that I don't accidentally upload certificates for non-TLS connections.
5. As a user, I want the port field to be required with no default value, so that I must explicitly choose the correct port rather than accidentally using a default.
6. As a user, I want an error message if I include a port number inside the broker address, so that ports are consistently specified in the dedicated field.
7. As a user, I want my existing server configurations to be automatically migrated when the tls field is removed, with the protocol prefix correctly prepended based on my old TLS setting, so that I don't lose connections.

## Implementation Decisions

### Data Model

- **Remove `tls` from MqttServer**: The `tls: boolean` field is deleted from both `serverStore.ts` and `types.ts`. The protocol is now solely determined by the brokerUrl prefix.
- **brokerUrl must include protocol prefix**: Expected formats: `mqtt://host` or `mqtts://host`. The factory uses the raw brokerUrl value for URL construction without any transformation.
- **port is required with no default**: Previously defaulted to 8883. Now the user must explicitly enter a port number.

### Connection Factory

- **No protocol derivation**: The factory no longer decides `mqtt vs mqtts`. It directly concatenates `${server.brokerUrl}:${server.port}/mqtt`.
- **Mock factory unchanged**: Mock mode doesn't create real connections, so the brokerUrl value is irrelevant for MockMqttClient.

### Connection Pool

- **update() needsReconnect**: Remove the `oldServer.tls !== server.tls` comparison from the reconnect-trigger check (now 4 fields: brokerUrl, port, username, password).

### Test Connection

- **testConnection() signature**: Remove `tls: boolean` parameter. The temporary MqttServer constructed internally uses the brokerUrl as-is.

### Modal UI

- **TLS toggle is UI-only**: A Switch widget that is not bound to Form data. Behavior:
  - Auto-syncs with brokerUrl input: switches ON when value matches `mqtts://...`, OFF otherwise
  - Controls CA cert Upload: enabled when ON, disabled when OFF
  - Does NOT modify brokerUrl value
- **brokerUrl validation rules**:
  - Required, must match `/^mqtts?:\/\/.+/` (must start with mqtt:// or mqtts://)
  - Must NOT contain port (`:\d+` pattern); error message: "端口请填写在下方端口号字段"
  - Help text: "请包含协议前缀并去掉端口，如 mqtts://host.com"
- **CaCert Upload**: `disabled` prop bound to `!tlsEnabled`
- **Edit mode**: TLS switch initialized ON if brokerUrl starts with `mqtts://`, OFF otherwise

### Migration

- **runMigration update**: When migrating legacy Device data, prepend protocol prefix to brokerUrl based on the old `tls` field:
  - `tls === true` → brokerUrl gets `mqtts://` prefix
  - `tls === false` → brokerUrl gets `mqtt://` prefix
  - Skip prepend if brokerUrl already starts with `mqtt://` or `mqtts://`

## Testing Decisions

### What to test

Tests should verify **external behavior through public interfaces**, not internal implementation details.

| Module | Type | Focus |
|--------|------|-------|
| **Migration** | Unit | Old `tls` flag → prepend correct protocol prefix; no double-prefix when brokerUrl already has one; idempotency preserved |
| **ConnectionPool** | Unit | update() reconnect triggers on brokerUrl changes including protocol prefix changes; 4-field comparison works correctly |
| **ConnectionFactory (Real)** | Unit | URL construction uses raw brokerUrl without modification; verify correct URL formatting |

### What NOT to test

- UI form validation rules (Ant Design Form) — manual verification is sufficient
- MockMqttClient — unchanged, no new behavior
- Zustand store persistence — tested by the library

### Prior art

Existing test files at `src/mqtt/connectionPool.test.ts`, `src/mqtt/migration.test.ts`, `src/mqtt/rpc.test.ts`, `src/mqtt/router.test.ts` follow Vitest + manual test-double pattern.

## Out of Scope

- Auto-detecting TLS from port number (e.g., guessing 8883 = TLS)
- Having the TLS toggle modify the brokerUrl prefix on the fly
- Adding real MQTT connection integration tests
- Changing the AddDeviceModal which only reads `brokerUrl` for display purposes

## Further Notes

- 11 files changed across 4 layers: data model, connection infrastructure, UI, and tests
- CONTEXT.md already updated to reflect new MqttServer interface
- Migration ensures zero data loss for existing users during upgrade
