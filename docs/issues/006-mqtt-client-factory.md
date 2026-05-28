# Issue 006: MQTT 连接工厂重构

**关联**: [IMPLEMENTATION-PLAN-002](../IMPLEMENTATION-PLAN-002.md) — Slice 2
**标签**: needs-triage

---

## Execution Rules

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**
>
> **1. RED** — 先写一个测试，确认测试 FAIL。禁止一次写多个测试。
> **2. GREEN** — 写最少代码让当前测试 PASS。禁止预判未来测试。
> **3. REFACTOR** — 消除重复、深化模块。禁止 RED 期间重构。
>
> **硬禁止：**
> - 禁止"先全部实现再补测试"（水平切片反模式）
> - 禁止跳过 RED 直接写 GREEN
> - 测试必须通过公共接口验证行为，不耦合实现细节
> - 每次循环只一个测试 → 一个实现，垂直切片推进

## What to build

去掉全局 MQTT 单例，改为工厂函数 `createMqttConnection(config)`，按连接参数创建 MQTT 连接（含 TLS/CA 证书支持）。Mock 模式同样走工厂函数。

具体变更：
- 移除 `let client: MqttClientLike | null` 全局单例
- 移除 `getMqttClient()`、`getMqttClientSafely()`、`initMqttClient()`、`destroyMqttClient()`
- 新增 `createMqttConnection(config: MqttConnectionConfig): MqttClientLike`
- `MqttConnectionConfig` 包含完整的 Broker 连接参数
- `RealMqttAdapter` 构造时接收 TLS/CA 证书配置
- Mock 模式下 `MockMqttClient` 同样通过 `createMqttConnection` 创建

## Acceptance criteria

- [ ] 可以按不同参数创建多条独立的 MQTT 连接（Mock 模式验证）
- [ ] 每条连接有独立的 onConnect/onDisconnect/onMessage 回调
- [ ] Real 模式传 CA 证书字符串到 mqtt.connect 的 ca 参数
- [ ] Mock 模式下 `VITE_MQTT_MODE=mock` 创建 MockMqttClient
- [ ] 不再有全局 client 变量
- [ ] 不再从 env 读取 BROKER_URL/USERNAME/PASSWORD
- [ ] `MqttClientLike` 接口不变
- [ ] 移除 `env.ts` 中 4 个弃用的环境变量导出，仅保留 `MQTT_MODE`

## Blocked by

Issue 005 — Device 模型 + localStorage 持久化
