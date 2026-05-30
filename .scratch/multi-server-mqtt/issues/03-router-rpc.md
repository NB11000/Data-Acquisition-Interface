# Issue 3: Router + RPC 改造

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 3

## What to build

改造 Router 支持多连接消息分发（每条连接的 onMessage 闭包绑定 serverId）。改造 RPC Engine 支持 MachineId→serverId 内部路由解析 + 连接断开即 reject。附带 Router 和 RPC 单元测试。

## Acceptance criteria

- [ ] `src/mqtt/router.ts` 改造：`setupRouter(pool: ConnectionPool)` 为每条新连接注册 onMessage handler，闭包捕捉 serverId；分发顺序：`tryResolveRpc` → domain handlers（state/will/alarm/data）
- [ ] `src/mqtt/rpc.ts` 改造：
  - `sendRpcCommand(machineId, method, payload?)` 内部查 deviceStore → serverId → pool.publish(serverId, topic, payload)
  - correlation ID 生成与匹配不变
  - 新增：发送前检查连接状态，若 server 不在 connected 状态 → 立即 reject `CONNECTION_LOST`
  - 10s 超时不变
- [ ] 废弃 `getMqttClient()` 单例导出，所有模块改为通过 ConnectionPool 实例交互
- [ ] **RPC 单元测试**：MachineId→serverId 路由、correlation ID 匹配、超时 reject、连接断开立即 reject
- [ ] **Router 单元测试**：RPC 响应优先拦截、domain handler 分派、serverId 在消息上下文中传递、未知 topic 处理

## Blocked by

Issue 2 (ConnectionPool + DI)
