# Slice 3: Router 核心 handler — events/will 消息路由

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

**Router 改造**（`src/mqtt/router.ts`）：

1. 移除现有 `$SYS` handler（第 39-79 行），移除 `_onSysConnected` / `_onSysDisconnected` 变量和 `onSysConnected` / `onSysDisconnected` 导出函数
2. 移除现有简化 Will handler（第 102-109 行），替换为完整 `events/will` handler：
   - topic 匹配：`topic.endsWith('/events/will')`，提取 MachineId
   - JSON parse 得到 `DeviceStatusPayload`
   - 陌生 MachineId：查 `deviceStore.getState().devices.find(d => d.id === machineId)`，找不到则 return 丢弃
   - **上线（status="online"）**：幂等检查（比较 payload.ts 与已记录的 lastTs，不大于则跳过）→ 调用 `setOnline(id, true, "device_online")` → `pool.addOnlineClient(serverId, id)` → 清除 Will Banner
   - **崩溃（status="offline" && eventType="process_crashed"）**：幂等检查（lastEventType 已为 "process_crashed" 则跳过）→ 调用 `setOnline(id, false, "process_crashed")` → `mqttStore.setWill(id)` → `pool.removeOnlineClient(serverId, id)`。使用 `Date.now()` 作为崩溃探测时间（忽略 payload.ts=0）
   - **正常下线（status="offline" && eventType="device_offline"）**：幂等检查（ts）→ 调用 `setOnline(id, false, "device_offline")` → `pool.removeOnlineClient(serverId, id)`
   - 同一条消息处理完成后**不再** fall through 到后续 handler（return）

3. 移除旧版单连接 `setupMqttRouter` 中的对应处理（第 145-155 行、第 182-189 行）

**测试文件**（修改 `src/mqtt/router.test.ts`）：

移除旧 $SYS 测试用例，新增如下测试场景（每个场景一个红绿循环）：
1. topic 匹配并提取 MachineId — 合法 topic `daq/srv-01/events/will` 正确提取
2. 上线消息 → `setOnline(id, true, "device_online")` 被调用
3. 正常下线 → `setOnline(id, false, "device_offline")` 被调用
4. 崩溃 → `setOnline(id, false, "process_crashed")` + `setWill(id)` 被调用
5. 陌生 MachineId → `setOnline` 不被调用
6. ts 幂等：新 ts ≤ 旧 ts → 跳过更新
7. ts 幂等：新 ts > 旧 ts → 执行更新
8. 崩溃幂等：`lastEventType` 已是 `process_crashed` → 跳过更新
9. 崩溃幂等：`lastEventType` 非崩溃（已恢复后再崩溃）→ 执行更新
10. 崩溃使用本地时间 → `ts=0` 时忽略 payload 时间

## Acceptance criteria

- [ ] $SYS handler 代码和 onSysConnected/onSysDisconnected 导出完全删除
- [ ] events/will handler 处理三种 eventType，每种正确分发
- [ ] 幂等逻辑正确（ts 和 lastEventType 两条路径）
- [ ] 陌生 MachineId 安全丢弃
- [ ] 崩溃使用本地时间
- [ ] 所有 10 个测试场景通过
- [ ] `pnpm build` 类型检查通过

## Blocked by

ISSUE-001, ISSUE-002
