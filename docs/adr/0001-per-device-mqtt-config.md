# ADR 0001: 每设备独立 MQTT 配置

**日期**: 2026-05-28
**状态**: Superseded by [ADR 0003](./0003-explicit-mqtt-server.md)

## 背景

设备的 MQTT 连接信息（brokerUrl / port / username / password / tls / caCert）需要在前端存储和管理。存在两种设计：

- **方案 A**: 每设备自包含完整连接配置
- **方案 B**: Broker 配置全局统一，Device 只存 MachineId + name

## 决策

**选择方案 A: 每设备独立完整 MQTT 配置。**

## 理由

1. **不同设备可能连接不同 Broker** — 设备是独立的采集节点，无法保证所有设备注册在同一 Broker 下
2. **不同 Broker 需不同 TLS 证书** — CA 证书是 Broker 级别的，不同 Broker = 不同 CA，无法纳入全局共享配置
3. **领域模型正确性** — 两个设备共享同一 Broker 是巧合而非约束，不应在模型中硬编码这个巧合
4. **去中心化** — 避免维护多个 Broker 的全局配置映射表

## 代价

- localStorage 明文存储密码和证书内容，存在浏览器端泄露风险
- 切换连接不同 Broker 的设备需断开重连（TLS 握手延迟）
- 每个 Device 需填写完整连接信息，添加流程稍长

## 替代方案

方案 B (全局 Broker 配置): 更简单但无法支持多 Broker 场景，被否定。
