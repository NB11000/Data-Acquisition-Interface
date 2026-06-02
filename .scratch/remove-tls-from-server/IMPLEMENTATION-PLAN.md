# Implementation Plan: 删除 MqttServer.tls 字段

> **Parent**: [PRD](./PRD.md)
> **Date**: 2026-06-01

## Modules

| # | Module | File | Responsibility |
|---|--------|------|----------------|
| M1 | **Data Model — serverStore** | `src/stores/serverStore.ts` | 删除 MqttServer 接口 `tls`；保留其余字段与 CRUD 方法不变 |
| M2 | **Data Model — types** | `src/mqtt/types.ts` | 删除 MqttServer 和 LegacyDevice 接口中的 `tls` |
| M3 | **Connection Factory** | `src/mqtt/connectionFactory.ts` | 删除 `server.tls ? 'mqtts' : 'mqtt'` 逻辑，直接用 `\`${server.brokerUrl}:${server.port}/mqtt\`` |
| M4 | **Connection Pool** | `src/mqtt/connectionPool.ts` | `update()` 的 `needsReconnect` 移除 `oldServer.tls !== server.tls` |
| M5 | **Test Connection** | `src/mqtt/pool.ts` | `testConnection()` 删除 `tls: boolean` 参数；内部 server 构造去掉 `tls` |
| M6 | **Server Modal** | `src/components/modals/MqttServerModal.tsx` | 删 tls Form.Item；加 UI-only TLS Switch（跟随 brokerUrl 前缀，控制 CA 证书上传 disabled）；brokerUrl validator 校验前缀+禁端口；port 必填无默认值 |
| M7 | **Migration** | `src/mqtt/migration.ts` | 删除 UniqueBroker 的 `tls`；迁移时基于旧 `tls` 给 brokerUrl 补前缀 |
| M8 | **Tests — connectionPool** | `src/mqtt/connectionPool.test.ts` | 删 `tls` 引用 |
| M9 | **Tests — rpc** | `src/mqtt/rpc.test.ts` | 删 `tls` 引用 |
| M10 | **Tests — router** | `src/mqtt/router.test.ts` | 删 `tls` 引用 |
| M11 | **Tests — migration** | `src/mqtt/migration.test.ts` | 删 `tls` 引用；验证迁移时协议前缀补全 |

## Interfaces

### MqttServer (变更后)

```typescript
interface MqttServer {
  id: string;
  name: string;
  brokerUrl: string;     // 必须包含协议前缀，如 mqtts://host.com
  port: number;          // 必填，无默认值
  username: string;
  password: string;
  connected: boolean;
  connectionState?: PoolConnectionState;
  caCert?: string;
}
// 变更：删除 tls: boolean
```

### ConnectionPool.update() needsReconnect (变更后)

```
判断条件从 5 项变为 4 项：
  oldServer.brokerUrl !== server.brokerUrl
  || oldServer.port !== server.port
  || oldServer.username !== server.username
  || oldServer.password !== server.password
// 删除：oldServer.tls !== server.tls
```

### testConnection() 签名 (变更后)

```
testConnection(
  brokerUrl: string,   // 已含协议前缀
  port: number,
  username: string,
  password: string,
): Promise<boolean>
// 删除：tls: boolean 参数
```

### MqttServerModal 表单 (变更后)

```
字段列表：
  name         → Input, required
  brokerUrl    → Input, required, validator: /^mqtts?:\/\/.+/ && 不含 :\d+
  port         → InputNumber, required, 无默认值, 1-65535
  username     → Input, optional
  password     → Input.Password, optional
  TLS Switch   → UI-only, 不绑 Form, 随 brokerUrl 前缀自动切换, 控制 CA Upload disabled
  CA Cert      → Upload, disabled={!tlsEnabled}
```

## Data Flow

### Happy path: 用户添加 TLS 服务器

```
用户输入 brokerUrl "mqtts://emqx.example.cn", port 8883, 用户名密码
→ TLS Switch 自动检测 mqtts:// 前缀 → ON
→ CA 证书 Upload 变为可用 → 用户上传 .pem
→ 提交表单 → brokerUrl validator 通过（有前缀、无端口）
→ 组装 MqttServer（无 tls 字段）
→ serverStore.addServer() → localStorage 持久化
→ pool.create(server) → factory.createConnection(server)
→ URL 拼接: "mqtts://emqx.example.cn:8883/mqtt" ✓（无重复前缀）
```

### Happy path: 用户添加非 TLS 服务器

```
用户输入 brokerUrl "mqtt://broker.local", port 1883
→ TLS Switch 检测 mqtt:// 前缀 → OFF
→ CA 证书 Upload 不可用（灰显）
→ 组装 MqttServer，无 tls，无 caCert
→ URL: "mqtt://broker.local:1883/mqtt" ✓
```

### Error path: brokerUrl 含端口

```
用户输入 "mqtts://host.com:8883" → validator 检测到 :\d+ 模式
→ 提示 "端口请填写在下方端口号字段" → 提交被阻止
```

### Edge case: 迁移旧数据

```
旧 localStorage 有 { brokerUrl: "emqx.example.cn", port: 8883, tls: true }
→ runMigration() 检测 tls === true
→ brokerUrl 变为 "mqtts://emqx.example.cn"（补前缀）
→ 旧 tls 字段不写入新 MqttServer
→ 新 URL 拼接: "mqtts://emqx.example.cn:8883/mqtt" ✓
```

### Edge case: 迁移时 brokerUrl 已有前缀

```
旧数据: { brokerUrl: "mqtts://emqx.example.cn", tls: false }
→ runMigration() 检测 brokerUrl 已含 mqtts:// → 跳过补前缀
→ brokerUrl 保持 "mqtts://emqx.example.cn"
```

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| brokerUrl 直接透传 | 工厂不解析 brokerUrl | 避免重复协议推导逻辑；用户输入的原始 URL 即为权威来源 |
| TLS 开关不存数据 | 仅 UI 控件 | 协议已由 brokerUrl 前缀表达，无需冗余存储 |
| TLS 开关自动跟随 | 监听 brokerUrl 值变化 | 减少用户操作，且保证 UI 与实际配置一致 |
| port 无默认值 | 必填、无 initialValue | 8883 默认值在非 TLS 场景下是错误引导 |
| 迁移时补前缀 | 基于旧 tls 标志 | 确保升级用户连接不中断；避免无前缀 URL 导致工厂拼出无效地址 |
| 不自动检测端口号推断 TLS | 不做 | 8883 不总等于 TLS；用户显式指定前缀是最可靠方案 |

## Test Strategy

| Module | Type | Focus | What NOT to test |
|--------|------|-------|------------------|
| **Migration** | Unit (Vitest) | Old tls→prefix prepend; double-prefix avoidance; idempotency; empty/corrupt input | Actual localStorage I/O (mocked) |
| **ConnectionPool** | Unit (Vitest) | update() 4-field reconnect check; name-only change no reconnect; brokerUrl change triggers reconnect | Actual MQTT reconnection behavior |
| **ConnectionFactory** | Unit (Vitest) | URL construction with raw brokerUrl; verify correct concatenation format | TCP connection behavior |
| **Pool (testConnection)** | Unit (Vitest) | Signature updated, no tls param; internal server uses raw brokerUrl | Actual network test |

### Test infrastructure

- **Runner**: Vitest (already configured)
- **Location**: Test files adjacent to source (`src/mqtt/*.test.ts`)
- **Pattern**: Same as existing tests — manual test doubles, no heavy mocking framework

## Vertical Slice Design

### Slice 1: Data Model + Connection Infrastructure (Foundation)

**Dependencies**: None

**Modules**: M1 (serverStore), M2 (types), M3 (connectionFactory), M4 (connectionPool), M5 (pool.ts)

**What this enables**: All backend code no longer references `tls`. Connection URLs are constructed correctly. TypeScript compilation passes for all infrastructure code.

**Verification**: `pnpm build` passes (tsc + vite). Existing tests updated and passing.

**Tests**: M8 (connectionPool test), M9 (rpc test), M10 (router test) — remove tls references

---

### Slice 2: Modal UI + Migration

**Dependencies**: Slice 1

**Modules**: M6 (MqttServerModal), M7 (migration)

**What this enables**: Users can add/edit servers with the new protocol-in-URL model. TLS toggle auto-follows brokerUrl. Port is required. Existing data migrated correctly.

**Verification**: Open modal, type `mqtts://host.com` → TLS toggle ON → CA cert upload enabled. Type `mqtt://host.com` → TLS toggle OFF. Port field has no default. Old localStorage data migrates correctly on load.

**Tests**: M11 (migration test) — verify protocol prefix prepend during migration

---

Note: Only 2 slices needed — this is a focused refactoring with clear dependencies. Slice 1 must complete before Slice 2 (modal imports from the updated serverStore and pool).
