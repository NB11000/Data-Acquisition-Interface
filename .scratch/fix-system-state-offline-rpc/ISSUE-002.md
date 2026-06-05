# ISSUE-002: 新增 isOnline 监听 Effect — 上线自动补发 RPC

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

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

在 `useMqttConnect.ts` 中新增两个 Effect：

**Effect 1 — isOnline 变化监听**：
- 订阅当前选中设备的 `isOnline` 和 `selectedId`
- 用 `prevOnlineRef` 记录上一轮 `isOnline` 值
- 当 `prevOnlineRef.current` 不是 true（即 false 或 null）且当前 `isOnline === true` 时，调用 `sendStateRpcWithRetry(pool, selectedId)` 补发
- 发送前清理飞行中的旧 RPC（`cancelStateRpcRef.current?.()`）
- 更新 `prevOnlineRef.current = isOnline`

**Effect 2 — selectedId 变化重置 ref**：
- 依赖 `[selectedId]`，每次设备切换时将 `prevOnlineRef.current` 重置为 `null`
- 防止残留旧设备的 isOnline 记忆导致误判

**数据获取**：
```typescript
const selectedDevice = useDeviceStore((s) =>
  s.devices.find(d => d.id === s.selectedId)
);
const isOnline = selectedDevice?.isOnline ?? null;
```

## Acceptance criteria

- [ ] 当前选中设备的 isOnline 从 false 变为 true 时，sendStateRpcWithRetry 被调用
- [ ] 当前选中设备的 isOnline 从 null 变为 true 时，sendStateRpcWithRetry 被调用
- [ ] isOnline 保持 true（true→true）时不触发重复调用
- [ ] selectedId 变化时 prevOnlineRef 被重置为 null
- [ ] 补发前清理了飞行中的旧 RPC
- [ ] 现有测试全部通过，构建无类型错误

## Blocked by

ISSUE-001（需要在设备切换 Effect 已跳过离线设备 RPC 的前提下，验证上线补发逻辑）
