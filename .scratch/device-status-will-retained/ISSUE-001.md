# Slice 1: 类型定义 + Topics 常量子初始化

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

1. **`DeviceStatusPayload` 类型**（`src/mqtt/types.ts`）：替换现有的 `WillMessage` 接口，定义 6 字段 Payload 接口（status, ts, eventType, source, message, timestamp）。保留 `WillMessage` 不删（后续 Slice 会迁移引用）。

2. **`allDevicesWillTopic` 常量**（`src/mqtt/topics.ts`）：新增 `allDevicesWillTopic()` 返回 `"daq/+/events/will"`。删除 `sysClientConnectedTopic()` 和 `sysClientDisconnectedTopic()` 函数及其 export。

## Acceptance criteria

- [ ] `DeviceStatusPayload` 类型定义包含全部 6 个字段，类型正确
- [ ] `allDevicesWillTopic()` 返回 `"daq/+/events/will"`
- [ ] `sysClientConnectedTopic` 和 `sysClientDisconnectedTopic` 已删除
- [ ] 引用这两函数的调用点已删除或替换
- [ ] `pnpm build` 类型检查通过

## Blocked by

None - can start immediately
