# Implementation Plan: brokerUrl 与 port 合二为一

> **Parent**: [PRD](./PRD.md)
> **Date**: 2026-06-01

## Modules

| # | Module | File | Responsibility |
|---|--------|------|----------------|
| M1 | **Data Model — serverStore** | `src/stores/serverStore.ts` | 删除 `port` 字段；`findDuplicate` 改为 `(brokerUrl, username)` |
| M2 | **Data Model — types** | `src/mqtt/types.ts` | 删除 LegacyDevice 和 MqttServer 中的 `port` 字段 |
| M3 | **Connection Factory** | `src/mqtt/connectionFactory.ts` | 删除 URL 拼接端口逻辑，直接透传 brokerUrl；补全 caCert 到 mqtt.connect options |
| M4 | **Connection Pool** | `src/mqtt/connectionPool.ts` | `needsReconnect` 移除 port 比较项 |
| M5 | **Pool (testConnection)** | `src/mqtt/pool.ts` | 签名简化为 `(brokerUrl, username, password, caCert?)`；内部构造 server 移除 port |
| M6 | **Server Modal** | `src/components/modals/MqttServerModal.tsx` | 删除 port Form.Item；brokerUrl 校验改为"必须含端口"；help text 更新；handleTest/handleSave 移除 port |
| M7 | **Device Modal** | `src/components/modals/AddDeviceModal.tsx` | serverOptions 显示改为名称 + tooltip |
| M8 | **Migration** | `src/mqtt/migration.ts` | 迁移时拼接 `brokerUrl:port`；去重 key 移除 port |
| M9 | **Tests — connectionPool** | `src/mqtt/connectionPool.test.ts` | `server()` factory 删除 port；断言更新 |
| M10 | **Tests — rpc** | `src/mqtt/rpc.test.ts` | `makeServer()` 删除 port |
| M11 | **Tests — router** | `src/mqtt/router.test.ts` | `makeServer()` 删除 port |
| M12 | **Tests — migration** | `src/mqtt/migration.test.ts` | 删除 port 引用；验证迁移后的 brokerUrl 含端口 |
| M13 | **Documentation** | `CONTEXT.md` | 更新 MqttServer 接口文档 |

## Interfaces

### MqttServer (变更后)

```typescript
interface MqttServer {
  id: string;
  name: string;
  brokerUrl: string;     // 完整地址：mqtts://host.com:8883/mqtt
  // 删除 port: number
  username: string;
  password: string;
  connected: boolean;
  connectionState?: PoolConnectionState;
  caCert?: string;
}
```

### findDuplicate (变更后)

```
findDuplicate(brokerUrl: string, username: string): MqttServer | undefined
// 删除 port 参数
```

### testConnection (变更后)

```
testConnection(
  brokerUrl: string,     // 完整地址
  username: string,
  password: string,
  caCert?: string,       // 新增可选参数
): Promise<boolean>
```

### connectionFactory.createConnection URL 构建 (变更后)

```typescript
createConnection(server: MqttServer): MqttClientLike {
  const url = server.brokerUrl;  // 直接使用，不再拼接 port
  const client = mqtt.connect(url, {
    clientId: server.id,
    username: server.username,
    password: server.password,
    ca: server.caCert ? [server.caCert] : undefined,
    rejectUnauthorized: server.caCert ? true : false,
    keepalive: 30,
  });
  return new RealMqttAdapter(client);
}
```

### MqttServerModal 表单 (变更后)

```
字段列表（5 项）：
  name         → Input, required
  brokerUrl    → Input, required
                 validator 1: /^(mqtts?|wss?):\/\/.+/ (协议前缀)
                 validator 2: 必须含 :\d+ (端口号)
                 help: "请输入完整 Broker 地址，如 mqtts://host.com:8883/mqtt"
  username     → Input, optional
  password     → Input.Password, optional
  TLS Switch   → 手动控制，双向校验
  CA Cert      → Upload, disabled={!tlsEnabled}
```

### AddDeviceModal serverOptions (变更后)

```typescript
const serverOptions = servers.map((s) => ({
  value: s.id,
  label: s.name,           // 仅显示名称
  title: s.brokerUrl,      // hover tooltip 显示完整 URL
}));
```

## Data Flow

### Happy path: 用户粘贴完整 URL 添加服务器

```
用户粘贴 "mqtts://emqx.example.cn:8883/mqtt" → brokerUrl 表单项
→ 协议前缀校验通过（mqtts://）→ 端口号校验通过（:8883）
→ TLS 开关手动开启
→ 上传 CA 证书 .pem
→ 保存时 TLS 双向校验通过
→ 组装 MqttServer { brokerUrl: "mqtts://emqx.example.cn:8883/mqtt" }
→ factory.createConnection(server)
→ URL 直接透传给 mqtt.connect → 连接成功
```

### Happy path: 已有旧数据迁移

```
旧数据: { brokerUrl: "mqtts://emqx.example.cn", port: 8883 }
→ runMigration() 检测旧格式
→ 拼接: "mqtts://emqx.example.cn" + ":" + 8883 → "mqtts://emqx.example.cn:8883"
→ 生成新 MqttServer { brokerUrl: "mqtts://emqx.example.cn:8883" }
→ 拼接时已有协议前缀，不再补充
```

### Error path: URL 缺少端口号

```
用户输入 "mqtts://host.com" → brokerUrl 校验
→ 协议前缀校验通过 ✓
→ 端口号校验（/:\d+/）失败 ✗
→ 提示 "请包含端口号，如 mqtts://host.com:8883/mqtt"
→ 提交被阻止
```

### Error path: TLS 开关与 URL 矛盾

```
用户输入 "mqtt://host.com:1883/mqtt"，TLS 开关 → ON
→ 保存 → isEncryptedUrl = false（非加密前缀）
→ 校验失败："TLS 已开启，Broker 地址必须以 mqtts:// 或 wss:// 开头"
```

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| 端口号校验（含 :\d+） | 采用 | 端口遗漏是易错点，前置拦截比超时报错体验好 |
| 迁移不猜测路径 | 仅拼接 brokerUrl:port | 路径由用户决策；/mqtt 非通用标准 |
| caCert 同步修复 | URL 合并时一并修 | 同一轮改 8 层，避免 caCert 断裂遗留 |
| TLS 双向校验不变 | 保持 | 校验逻辑与端口字段无关，无需改动 |
| AddDeviceModal 简化为名称 | hover tooltip 显示 URL | 完整 URL 过长，Select 下拉框会被撑开 |

## Test Strategy

| Module | Type | Focus | What NOT to test |
|--------|------|-------|------------------|
| **ConnectionFactory** | Unit (Vitest) | URL 透传不拼接；caCert 传入 options | 实际网络连接 |
| **ConnectionPool** | Unit (Vitest) | needsReconnect 不比较 port；brokerUrl 变化触发重连 | 实际 MQTT 重连 |
| **Migration** | Unit (Vitest) | brokerUrl:port 拼接；去重 key 不含 port | 实际 localStorage 读写 |

### Test infrastructure

- **Runner**: Vitest (已配置)
- **Location**: 源文件相邻 `src/mqtt/*.test.ts`
- **Pattern**: 与现有测试一致 — 手动 test-double

## Vertical Slice Design

### Slice 1: Data Model + Connection Infrastructure (Foundation)

**Dependencies**: None

**Modules**: M1 (serverStore), M2 (types), M3 (connectionFactory), M4 (connectionPool), M5 (pool.ts)

**Tests**: M9 (connectionPool test), M10 (rpc test), M11 (router test) — 删除 port 引用

**Verification**: `pnpm build` 通过；测试文件更新后通过

---

### Slice 2: Modal UI + Migration

**Dependencies**: Slice 1

**Modules**: M6 (MqttServerModal), M7 (AddDeviceModal), M8 (migration), M13 (CONTEXT.md)

**Tests**: M12 (migration test) — 验证 brokerUrl:port 拼接

**Verification**: 手动验证表单：粘贴完整 URL → 校验通过 → 保存成功 → 重新打开编辑 → 数据正确回显
