# ISSUE-003: allDisabled 移除 processConnected + 测试更新

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

## Execution Rules

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**

## What to build

### StatusControlBar.tsx

```typescript
// Before
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice || !processConnected;

// After
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice;
```

### StatusControlBar.test.tsx

更新测试 `processConnected 为 false 时按钮不因此 disabled`：
- Mock `processConnected = false`，其他条件正常
- 断言按钮 `.not.toBeDisabled()`

## Acceptance criteria

- [ ] processConnected=false 且其他条件正常时按钮不禁用
- [ ] mqttConnected=false 时按钮仍禁用
- [ ] willReceived=true 时按钮仍禁用
- [ ] selectedId=null 时按钮仍禁用
- [ ] selectedDevice=null 时按钮仍禁用
- [ ] 现有测试全部通过

## Blocked by

ISSUE-002（桥接就绪后，state_changed 的 processConnected 更新可触发按钮文本刷新）
