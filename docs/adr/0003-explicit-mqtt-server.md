# ADR 0003: 显式 MqttServer 实体

**日期**: 2026-05-30
**状态**: Accepted

## 背景

ADR 0001 选择了"每 Device 自包含完整 MQTT 配置"——Device 携带 brokerUrl、port、username、password、tls、caCert 全部字段。ADR 0002 在 Device 之上建立了隐式连接池（按 `brokerUrl:port:username:password` 自动分组）。

这种设计有 UX 缺陷：用户每次添加设备都需重复输入完整的连接参数（地址、端口、用户名、密码、TLS），对"同一个 Broker 下有 10 个设备"的场景尤为繁琐。此外，Broker 概念不显式存在，用户无法对"一个物理服务器"进行命名和集中管理。

## 决策

**引入显式 MqttServer 实体。** Device 的 MQTT 连接配置剥离到 MqttServer，Device 仅通过 `serverId` 引用。

新数据模型：

```
MqttServer { id, name, brokerUrl, port, username, password, tls, caCert, isConnected }
Device     { id, name, serverId, isOnline }
```

连接池 key 由 `brokerUrl:port:username:password` 变为 `serverId`。

## 理由

1. **UX 简化** — 用户在添加第一个设备时填写一次 Broker 信息，后续同 Broker 设备只需选服务器 + 输入 Device ID。消除了 ADR 0001 代价中"添加流程稍长"的问题。
2. **可命名可管理** — Broker 以"生产环境""测试服务器"等名称出现，用户可在系统设置中集中查看、编辑、管理所有服务器。
3. **领域模型正确性** — "设备专属 Broker"是广告牌（billboard）而非领域事实。显式 MqttServer 使归属关系明确。
4. **统一凭证** — 设计约束为"同一服务器下所有 Device 共享凭证"。若未来需跨账号 ACL，将为前端分配专用账号解决。

## 与 ADR 0001 的关系

ADR 0001 第 3 条理由"两个设备共享同一 Broker 是巧合而非约束"在此被逆转。经验证，同一 Broker 下有多设备是常态而非巧合，将 Broker 提升为显式实体反映该领域事实。

ADR 0001 已被标记为 Superseded。

## 代价

- 数据模型增加一层实体（用户需理解"服务器 → 设备"层级）
- 新增 MqttServer 的 CRUD UI
- localStorage 新增 key `mqttServers`
- 旧 Device 数据需自动迁移

## 替代方案

**保持 ADR 0001/0002 的隐式分组**：在 Device 上增加 `serverLabel` 字段仅用于显示，不做显式实体。被否定 —— 无法解决重复输入问题，无法集中管理服务器。
