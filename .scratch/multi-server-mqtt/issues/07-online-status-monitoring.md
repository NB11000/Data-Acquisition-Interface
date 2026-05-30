# Issue 7: 在线状态监控

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

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 7

## What to build

实现 $SYS 主题的在线状态监控：每条连接独立监听 `$SYS/brokers/+/clients/+/connected` 和 `/disconnected`，更新对应 serverId 下的 Device.isOnline 和 OnlineClientCache。处理重连后 retain 消息回放。连接断开期间数据显示保持。

## Acceptance criteria

- [ ] Router 中注册 $SYS 消息处理：
  - `$SYS/.../connected` → 从 topic 提取 clientId → 更新 `pool.onlineClientCache[serverId].add(clientId)` → 查 deviceStore 该 serverId 下是否匹配该 clientId 的 Device → 有则 `deviceStore.setOnline(id, true)`
  - `$SYS/.../disconnected` → 同上逻辑 → `.delete(clientId)` → `deviceStore.setOnline(id, false)`
  - 闭包绑定的 serverId 确保只更新该 server 的设备
- [ ] 连接建立后 Broker 推送的 retain Will/Alarm 消息照单全收，不做特殊过滤
- [ ] 连接失败/断开时，该 server 下所有 Device `isOnline` 设为 `null`（未知）
- [ ] 仪表盘数据区在连接断开时保留上次数据不变 → 顶部显示半透明 banner "连接已断开 —— 实时数据暂不可用"
- [ ] RPC 操作在连接非 connected 状态时 immediate reject + toast "服务器 {name} 未连接，请稍后重试"

## Blocked by

Issue 6 (Sidebar — 在线状态图标显示), Issue 3 (Router+RPC)
