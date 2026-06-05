# ISSUE-001: 新增 systemStateBridge 共享桥接模块

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

## Execution Rules

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**
>
> **1. RED** — 先写一个测试，确认测试 FAIL。禁止一次写多个测试。
> **2. GREEN** — 写最少代码让当前测试 PASS。禁止预判未来测试。
> **3. REFACTOR** — 消除重复、深化模块。禁止 RED 期间重构。

## What to build

新建 `src/hooks/systemStateBridge.ts`，导出两个函数：

```typescript
type StateUpdateFn = (state: Record<string, unknown>) => void;
let notify: StateUpdateFn | null = null;

export function setBridgeCallback(fn: StateUpdateFn | null) {
  notify = fn;
}

export function triggerSystemStateUpdate(state: Record<string, unknown>) {
  notify?.(state);
}
```

模块级变量 `notify` 存储回调引用。`setBridgeCallback` 由 useMqttConnect 注册/注销。`triggerSystemStateUpdate` 由 router.ts 和 handleResult 调用。回调为 null 时静默跳过。

## Acceptance criteria

- [ ] `setBridgeCallback` 可注册和清空回调
- [ ] `triggerSystemStateUpdate` 在回调已注册时正确调用
- [ ] `triggerSystemStateUpdate` 在回调为 null 时不报错
- [ ] tsc 编译无类型错误

## Blocked by

无 — 可立即开始
