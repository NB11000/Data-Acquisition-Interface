# Issue 002: MQTT 客户端重构 — 按设备配置连接

**标签**: needs-triage
**父文档**: [IMPLEMENTATION-PLAN-001](../IMPLEMENTATION-PLAN-001.md)

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

1. 修改 `mqtt/client.ts` — `initMqttClient` 接收完整 Device 对象，将 `ca`/`cert`/`key` 传入 `mqtt.connect()` 选项
2. 新增 `destroyCurrentClient()` — 断开当前活跃连接
3. 新增 `getCurrentBrokerUrl()` — 返回当前连接的 brokerUrl（供切换逻辑判断）
4. 清理 `.env` 中的 `VITE_BROKER_URL` / `VITE_BROKER_USERNAME` / `VITE_BROKER_PASSWORD`
5. 更新 `env.ts` 仅导出 `MQTT_MODE` 和 `DEFAULT_MACHINE_ID`

## Acceptance criteria

- [ ] `initMqttClient(device)` 使用 device.brokerUrl 而非全局 env 变量连接
- [ ] `initMqttClient(device)` 在 device.tls=true 且 device.caCert 存在时，将 ca 证书传入 mqtt.connect()
- [ ] `destroyCurrentClient()` 正确断开连接并清理引用
- [ ] `getCurrentBrokerUrl()` 返回当前连接 brokerUrl，无连接时返回 null
- [ ] Mock 模式下行为不变（mock 不依赖真实连接参数）
- [ ] `.env` 中不再有全局 Broker 变量

## Blocked by

#001 — Device 模型扩展 + localStorage 持久化
