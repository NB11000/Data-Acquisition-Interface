# PRD: MqttServerModal brokerUrl 与 port 合二为一

> **状态**: needs-triage
> **日期**: 2026-06-01

## Problem Statement

当前 MqttServer 表单将 Broker 地址拆分为 `brokerUrl`（主机+协议前缀）和 `port`（端口号）两个独立字段，存在以下问题：

1. **用户需手动拆分 URL**：从 EMQX 控制台复制的连接地址为完整格式（如 `mqtts://host.com:8883/mqtt`），用户不得不手动拆分到两个字段
2. **数据冗余**：端口作为独立字段存储，但 URL 本就可以承载端口信息，存在不一致风险
3. **字段过多**：表单 6 个字段（name / brokerUrl / port / username / password / TLS），认知负担偏重
4. **测试连接遗漏 caCert**：`testConnection` 签名未传递 CA 证书，TLS 场景下测试连接结果不可靠

## Solution

将 `brokerUrl` 和 `port` 合并为单一字段，用户直接输入完整的 Broker 连接地址（含协议前缀、主机、端口、路径）。删除 `MqttServer` 接口中的 `port: number` 字段，连接工厂不再拼接端口，直接透传完整 URL。同步修复 `testConnection` 和 `connectionFactory` 中 caCert 链路的断裂。

## User Stories

1. As a user, I want to paste the complete broker address (e.g., `mqtts://host.com:8883/mqtt`) into a single input field, so that I don't need to manually split it into host and port
2. As a user, I want the form to validate that I've included the protocol prefix (`mqtt://` / `mqtts://` / `ws://` / `wss://`), so that the connection URL is always well-formed
3. As a user, I want the CA certificate to be used not only for storage but also for actual connection and testing, so that TLS validation works correctly
4. As a user editing an existing server, I want my previously stored server configuration to be correctly loaded, so that I can modify it without re-entering everything
5. As a user with old server data (split brokerUrl + port), I want my data to be automatically migrated to the new format, so that I don't lose configurations
6. As a user, I want to see the full server URL on hover in the device add modal, so that I can distinguish between servers with similar names
7. As a user, I want the connection test to validate TLS certificates when TLS is enabled, so that I can confirm the certificate is correct before saving

## Implementation Decisions

### Data Model

- **Remove `port` from MqttServer**: `port: number` 字段从 `serverStore.ts` 和 `types.ts` 中删除，端口信息由 brokerUrl 自行携带
- **brokerUrl 为完整地址**：包含协议前缀 + 主机 + 端口 + 可选路径（如 `mqtts://host.com:8883/mqtt`）
- **findDuplicate 简化**：从 `(brokerUrl, port, username)` 变为 `(brokerUrl, username)`

### Connection Factory

- **URL 直接透传**：不再拼接 `${brokerUrl}:${port}`，直接使用完整的 `server.brokerUrl`
- **caCert 链路修复**：`mqtt.connect()` 补充传入 `ca`、`rejectUnauthorized` 等 TLS 选项

### Connection Pool

- **needsReconnect 简化**：不再比较 `port` 字段

### Test Connection

- **签名简化**：`testConnection(brokerUrl, port, username, password)` → `testConnection(brokerUrl, username, password, caCert?)`
- **caCert 补传**：测试连接时传入 CA 证书，使 TLS 场景下测试结果可靠

### Modal UI

- **删除 port 表单项**：InputNumber 及校验规则全部移除
- **brokerUrl 校验调整**：
  - 协议前缀校验不变：`/^(mqtts?|wss?):\/\/.+/`
  - 删除"禁止含端口"的 validator
  - 新增"端口必填"校验：URL 必须包含 `:\d+`，否则提示"请包含端口号"
- **help text 更新**：改为"请输入完整 Broker 地址，如 mqtts://host.com:8883/mqtt"
- **表单布局不变**：6 字段减为 5 字段
- **edit 回填移除** `port: server.port`

### AddDeviceModal

- **服务器选项显示**：缩短为 `${s.name}`，hover tooltip 展示完整 URL

### Migration

- **旧数据合并**：`runMigration()` 将 `brokerUrl + ':' + port` 拼接为完整 URL，不猜测路径
- **去重 key** 移除 port

### TLS 校验

- **TLS 双向校验不变**：TLS ON → 加密前缀 / TLS OFF → 非加密前缀

## Testing Decisions

### What to test

| 模块 | 类型 | 关注点 |
|------|------|--------|
| **ConnectionFactory** | 单元 | URL 直接透传不做拼接；caCert 传入 mqtt.connect options |
| **ConnectionPool** | 单元 | needsReconnect 不再比较 port |
| **Migration** | 单元 | 旧 brokerUrl:port 合并正确；去重 key 不含 port |

### Prior art

沿用现有 `src/mqtt/*.test.ts` 的 Vitest + 手动 test-double 模式。

## Out of Scope

- URL 中自动添加 `/mqtt` 路径（由用户自行决定）
- ws/wss 协议的 mock 支持
- CA 证书有效性校验（过期检测、格式校验）
- 端口号从 URL 自动解析提取

## Further Notes

- 共涉及 8 层 12 个文件：数据模型 2 个 + 连接基础设施 2 个 + UI 2 个 + 迁移 1 个 + 测试 4 个 + 文档 1 个
- caCert 修复与 URL 合并同步进行，避免两轮改动
- `types.ts` 中 MqttServer 缺少 `caCert` 和 `connectionState` 字段（已知不一致），本次暂不修复
