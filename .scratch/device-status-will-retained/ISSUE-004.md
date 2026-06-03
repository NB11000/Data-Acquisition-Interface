# Slice 4: ConnectionPool 适配 — 通配符订阅 + 移除 $SYS

> **标签**: needs-triage
> **日期**: 2026-06-03

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

[Implementation Plan](IMPLEMENTATION-PLAN.md)

## What to build

**ConnectionPool 改造**（`src/mqtt/connectionPool.ts`）：

1. **废弃 `subscribeSysTopics`**：删除该方法及其中两个 `$SYS` 订阅调用
2. **通配符 will 订阅**：在 `create()` 的 onConnect 回调中，于恢复常驻主题之前，增加 `client.subscribe('daq/+/events/will')`（无 qos 参数或 qos=1）
3. **`subscribeDevice` 4→3**：从 `subscribeDevice()` 的 topics 数组中移除 `willTopic(machineId)` 行；`unsubscribeDevice()` 同理
4. **`emitStateChange` 增强**：在 `disconnected/reconnecting/failed` 分支中，`setOnline(d.id, null)` 后追加 `setOnline(d.id, null, undefined)` 以确保 `lastEventType` 也清空。确认 `setOnline` 的两个参数调用已改为三个参数调用。
5. **在线客户端缓存不变**：`addOnlineClient` / `removeOnlineClient` / `getOnlineClients` 方法签名和实现保持不变——它们由 Slice 3 的 router handler 调用。

**常量引用更新**（`src/mqtt/connectionPool.ts`）：

- 导入语句：移除 `sysClientConnectedTopic / sysClientDisconnectedTopic` 导入（如存在），新增 `allDevicesWillTopic` 导入（如果通配符字符串直接在 subscribe 调用中硬编码则无需导入）

**旧版兼容函数**（如有）：

- 如果存在旧版 `createSingleConnection` 等函数中的 $SYS 订阅，同步移除

## Acceptance criteria

- [ ] `subscribeSysTopics` 方法及调用已删除
- [ ] onConnect 中执行 `client.subscribe('daq/+/events/will')`
- [ ] `subscribeDevice` 订阅 3 个主题（不含 will）
- [ ] `unsubscribeDevice` 取消 3 个主题（不含 will）
- [ ] 断连时 deviceStore 的 `isOnline` 和 `lastEventType` 均被清空
- [ ] 重连时通配符 will 主题被重新订阅
- [ ] `pnpm build` 类型检查通过

## Blocked by

ISSUE-001, ISSUE-003
