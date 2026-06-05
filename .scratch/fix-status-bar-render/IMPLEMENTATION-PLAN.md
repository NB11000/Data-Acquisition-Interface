# Implementation Plan: 状态栏按钮无法自动解灰

> **Parent**: [PRD](./PRD.md)
> **日期**: 2026-06-05

## Modules

| 模块 | 类型 | 单一职责 |
|------|------|----------|
| `systemStateBridge.ts` | 新增 | MQTT 回调 → React setState 桥接 |
| `useMqttConnect.ts` | 修改 | 注册桥接回调；`handleResult` 调用桥接 |
| `router.ts` | 修改 | `state_changed` handler 调用桥接 |
| `StatusControlBar.tsx` | 修改 | `allDisabled` 移除 `!processConnected` |
| `StatusControlBar.test.tsx` | 修改 | 更新 processConnected 相关断言 |

## Interfaces

### systemStateBridge.ts

```typescript
export function setBridgeCallback(fn: ((state: Record<string, unknown>) => void) | null): void
export function triggerSystemStateUpdate(state: Record<string, unknown>): void
```

- `setBridgeCallback` — 注册/注销回调（由 useMqttConnect useEffect 调用）
- `triggerSystemStateUpdate` — 触发回调（由 router.ts 和 handleResult 调用）
- 回调为 null 时 `triggerSystemStateUpdate` 静默跳过

### StatusControlBar allDisabled

```typescript
// Before
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice || !processConnected;
// After
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice;
```

## Data Flow

### 设备上线 → 采集子进程就绪 → 按钮解灰

```
设备上线 (MQTT 重连)
  → system-state RPC → applyState({processConnected: false}) → triggerSystemStateUpdate
  → allDisabled = false (移除了!processConnected) → 按钮可点

采集子进程启动
  → state_changed 事件 (processConnected: true)
  → router.ts: applyState({processConnected: true}) → triggerSystemStateUpdate
  → 桥接 → React setState → useMqttConnect 重渲染
  → useEffect → applyState({processConnected: true}) (再次)
  → StatusControlBar 重渲染 → processConnected=true 用于按钮文本
```

## Key Technical Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 桥接模块 | 独立 `systemStateBridge.ts` | 避免 `useMqttConnect` → `router` → `useMqttConnect` 循环依赖 |
| allDisabled | 移除 `!processConnected` | 置灰阻断不如后端报错告知明确原因 |
| 双路径 applyState | 直接+桥接并行 | 直接路径覆盖正常情况，桥接兜底外部回调场景 |
| router.ts 改动 | 仅加一行 `triggerSystemStateUpdate` | 最小侵入，不改变现有逻辑 |

## Test Strategy

| 测试 | 类型 | 验证 |
|------|------|------|
| processConnected=false 按钮不禁用 | 集成 | allDisabled 不包含 processConnected |
| 其他 allDisabled 条件正常 | 集成 | mqttConnected/willReceived/selectedId/selectedDevice 仍影响按钮禁用 |

## Vertical Slice Design

### Slice 1: systemStateBridge.ts 共享模块
- 新增文件，导出 `setBridgeCallback`、`triggerSystemStateUpdate`
- 无依赖

### Slice 2: useMqttConnect.ts + router.ts 接入桥接
- 引入桥接模块；`handleResult` 调用桥接
- router.ts `state_changed` handler 调用桥接
- 依赖 Slice 1

### Slice 3: StatusControlBar allDisabled 变更
- 移除 `!processConnected`
- 依赖 Slice 2（桥接就绪，state_changed 更新可触发重渲染）
