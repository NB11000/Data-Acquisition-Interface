# Issue 005: Device 模型扩展 + localStorage 持久化

**关联**: [IMPLEMENTATION-PLAN-002](../IMPLEMENTATION-PLAN-002.md) — Slice 1
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

扩展 Device 模型（`isOnline: boolean | null`、`caCert?: string`），并实现 localStorage 持久化。页面刷新后设备列表自动恢复。

具体变更：
- `Device.isOnline` 从 `boolean` 改为 `boolean | null`（null = 未知）
- `Device` 加 `caCert?: string` 字段
- deviceStore 加 persist middleware：`loadDevices()` / `saveDevices()`
- 页面初始化时从 localStorage 加载设备列表

## Acceptance criteria

- [ ] `isOnline` 支持三态：`true`、`false`、`null`
- [ ] Device 模型包含 `caCert` 字段（可选）
- [ ] store 初始化时自动调用 `loadDevices()` 恢复设备列表
- [ ] 设备列表变化时自动调用 `saveDevices()`（state.subscribe）
- [ ] localStorage 读/写往返数据一致性：存入再取出，Device 各字段不变
- [ ] localStorage 为空时设备列表为空（不报错）
- [ ] localStorage 数据格式错误时降级为空列表（不崩溃）

## Blocked by

None — 可立即开始
