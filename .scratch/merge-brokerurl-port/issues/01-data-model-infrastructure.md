# Issue 1: 数据模型 + 连接基础设施 — 删除 port 字段

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

## Parent

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 1

## What to build

删除 `MqttServer` 接口中的 `port: number` 字段，URL 直接透传不再拼接端口。连接工厂同步补全 caCert 到 mqtt.connect options。

## Acceptance criteria

- [ ] `src/stores/serverStore.ts` — MqttServer 接口删除 `port: number`；`findDuplicate` 改为 `(brokerUrl, username)`，内部不再匹配 port
- [ ] `src/mqtt/types.ts` — MqttServer 和 LegacyDevice 接口删除 `port`
- [ ] `src/mqtt/connectionFactory.ts` — URL 拼接改为 `${server.brokerUrl}` 直接透传；`mqtt.connect()` options 补全 `ca` 和 `rejectUnauthorized`
- [ ] `src/mqtt/connectionPool.ts` — `update()` 的 `needsReconnect` 删除 `oldServer.port !== server.port` 比较项
- [ ] `src/mqtt/pool.ts` — `testConnection` 签名删除 `port` 参数，新增可选 `caCert?` 参数；构造 server 时删除 port 字段，补全 caCert
- [ ] `src/mqtt/connectionPool.test.ts` — `server()` 工厂函数删除 `port: 1883`；所有引用 `s.port` 的断言删除或更新
- [ ] `src/mqtt/rpc.test.ts` — `makeServer()` 删除 `port: 1883`
- [ ] `src/mqtt/router.test.ts` — `makeServer()` 删除 `port: 1883`
- [ ] `pnpm build` 通过（tsc + vite）

## Blocked by

None — can start immediately
