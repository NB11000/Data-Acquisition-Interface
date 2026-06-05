# ISSUE-002: useMqttConnect + router.ts 接入桥接

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

## Execution Rules

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**

## What to build

### useMqttConnect.ts

1. 引入 `setBridgeCallback` 和 `triggerSystemStateUpdate` 从 `./systemStateBridge`
2. 移除私有模块级 `notifySystemState` 和 `triggerSystemStateUpdate`
3. 注册 Effect 改用 `setBridgeCallback(fn)` / `setBridgeCallback(null)`
4. `handleResult` 保留双路径：直接 `applyState` + `triggerSystemStateUpdate`

### router.ts

1. 引入 `triggerSystemStateUpdate` 从 `../hooks/systemStateBridge`
2. `state_changed` handler 中 `applyState` 后追加 `triggerSystemStateUpdate(event.state)`

### 诊断日志清理

移除前轮调试中残留的所有 `console.log`。

## Acceptance criteria

- [ ] `handleResult` 同时执行直接 applyState 和 triggerSystemStateUpdate
- [ ] router.ts state_changed handler 追加 triggerSystemStateUpdate 调用
- [ ] 所有 console.log 诊断日志已清理
- [ ] 现有测试全部通过，构建无类型错误
- [ ] 无循环依赖

## Blocked by

ISSUE-001（需要 systemStateBridge.ts 存在）
