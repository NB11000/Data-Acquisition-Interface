# ISSUE-003: 重连路径 + StrictMode 兜底路径加 isOnline 检查

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

在 `useMqttConnect.ts` 的两处连接恢复路径增加 `device.isOnline` 检查：

**路径1** — `onStateChange` 回调中 `state === 'connected'`：
- 在 `pool.subscribeDevice` 之前增加 `if (!device.isOnline) return;`

**路径2** — StrictMode 兜底 Effect：
- 在 `pool.subscribeDevice` 之前增加 `if (!device.isOnline) return;`

两条路径的 `subscribeDevice` 和 `switchFollowing` 调用也随 RPC 一并跳过（因为设备离线时订阅其主题无意义，且上线后 isOnline Effect 会补发 RPC 并触发主题订阅）。

## Acceptance criteria

- [ ] MQTT 重连成功后，若当前设备 isOnline=true，发送 system-state RPC
- [ ] MQTT 重连成功后，若当前设备 isOnline=false，不发送 system-state RPC
- [ ] StrictMode 兜底路径：isOnline=false 时不发送 RPC
- [ ] 三条路径（设备切换、重连、StrictMode 兜底）的 isOnline 门控行为一致
- [ ] 现有测试全部通过，构建无类型错误

## Blocked by

ISSUE-001, ISSUE-002（需要 isOnline 门控和补发逻辑已就绪，确保三路径行为对齐）
