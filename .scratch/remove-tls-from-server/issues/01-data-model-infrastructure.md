# Issue 1: 数据模型 + 连接基础设施 — 删除 tls 字段

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

从数据模型和连接基础设施层删除 `tls: boolean` 字段。协议改由 brokerUrl 前缀携带（`mqtt://` 或 `mqtts://`），连接工厂不再推导协议，直接使用用户输入的完整 brokerUrl 拼接连接 URL。

## Acceptance criteria

- [ ] `src/stores/serverStore.ts` — MqttServer 接口删除 `tls: boolean`
- [ ] `src/mqtt/types.ts` — MqttServer 和 LegacyDevice 接口删除 `tls`
- [ ] `src/mqtt/connectionFactory.ts` — 删除 `server.tls ? 'mqtts' : 'mqtt'`，URL 改用 `` `${server.brokerUrl}:${server.port}/mqtt` ``
- [ ] `src/mqtt/connectionPool.ts` — `update()` 的 `needsReconnect` 判断删除 `oldServer.tls !== server.tls`
- [ ] `src/mqtt/pool.ts` — `testConnection()` 签名删除 `tls: boolean` 参数；内部构造的临时 server 对象删除 `tls`
- [ ] `src/mqtt/connectionPool.test.ts` — `server()` 工厂函数删除 `tls: false`；所有测试断言更新
- [ ] `src/mqtt/rpc.test.ts` — `makeServer()` 删除 `tls: false`
- [ ] `src/mqtt/router.test.ts` — `makeServer()` 删除 `tls: false`

## Blocked by

None — can start immediately
