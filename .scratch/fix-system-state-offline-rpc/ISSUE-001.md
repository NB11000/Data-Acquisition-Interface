# ISSUE-001: 设备切换 Effect 加 isOnline 门控

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

修改 `useMqttConnect.ts` 的设备切换 Effect（`useEffect([selectedId])`），在发送 system-state RPC 前增加 `device.isOnline` 检查：

- `device.isOnline === true`：正常发送 RPC（现有行为）
- `device.isOnline !== true`：跳过 RPC，仅执行清空 stores + 订阅主题切换，更新 `prevSelectedRef`

跳过 RPC 时仍需更新 `prevSelectedRef.current = selectedId`，防止后续上线补发时使用错误的旧设备 ID。

## Acceptance criteria

- [ ] 点击 isOnline=true 的设备时，sendStateRpcWithRetry 被调用
- [ ] 点击 isOnline=false 的设备时，sendStateRpcWithRetry 不被调用
- [ ] 点击 isOnline=null 的设备时，sendStateRpcWithRetry 不被调用
- [ ] 离线设备切换时 stores 仍被清空 + 主题订阅仍被切换
- [ ] prevSelectedRef 在跳过 RPC 时也被正确更新
- [ ] 现有测试全部通过，构建无类型错误

## Blocked by

无 — 可立即开始
