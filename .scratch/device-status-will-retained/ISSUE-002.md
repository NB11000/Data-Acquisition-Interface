# Slice 2: deviceStore 扩展 — lastEventType 支持

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

**deviceStore 扩展**（`src/stores/deviceStore.ts`）：

1. `Device` 接口新增可选字段 `lastEventType?: 'device_online' | 'device_offline' | 'process_crashed'`
2. `setOnline` 方法签名改为 `setOnline(id, online, lastEventType?)`，实现双字段联动：
   - 传入 `lastEventType` 时同时设置
   - `online === null` 时 `lastEventType` 置为 `undefined`
   - 不存在设备 ID 时不做任何事

**测试文件**（`src/stores/deviceStore.test.ts`）：

红绿重构循环，每个场景一个循环：
1. `setOnline(true, "device_online")` → `isOnline=true, lastEventType="device_online"`
2. `setOnline(false, "device_offline")` → `isOnline=false, lastEventType="device_offline"`
3. `setOnline(false, "process_crashed")` → `isOnline=false, lastEventType="process_crashed"`
4. `setOnline(null)` → `isOnline=null, lastEventType=undefined`
5. 不存在的设备 ID → 设备列表不变

## Acceptance criteria

- [ ] `Device` 接口包含 `lastEventType` 可选字段
- [ ] `setOnline` 三参数签名工作正常
- [ ] `online === null` 时 `lastEventType` 被清空
- [ ] 5 个测试场景全部通过
- [ ] `pnpm build` 类型检查通过（现有调用 `setOnline(id, bool)` 不传第三参数仍兼容）

## Blocked by

ISSUE-001
