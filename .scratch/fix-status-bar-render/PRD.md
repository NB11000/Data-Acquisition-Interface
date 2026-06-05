# PRD: 状态栏按钮在设备上线后无法自动解灰

> **状态**: needs-triage
> **日期**: 2026-06-05

## Problem Statement

设备从离线状态恢复上线后，右侧状态栏（StatusControlBar）的控制按钮一直保持置灰，必须手动刷新页面才能恢复正常。经过诊断，根因有两个层面：

### 根因 1：system-state RPC 返回值 `processConnected=false`

设备上线（MQTT 重连）时，system-state RPC 返回的采集子进程状态为 `processConnected: false`（采集子进程尚未启动）。`allDisabled` 公式中包含 `!processConnected`，导致全部按钮持续置灰。采集子进程启动后通过 `state_changed` 事件推送 `processConnected: true`，但此时 Zustand store 更新发生在 MQTT 回调中（React 外部），不触发 StatusControlBar 重渲染。

### 根因 2：MQTT 回调链中 Zustand 更新不触发 React 重渲染

`router.ts` 的 `state_changed` handler 和 `sendStateRpcWithRetry` 的 `handleResult` 均在 MQTT WebSocket 回调 → Promise `.then()` 链中调用 `Zustand.set()`。在这些外部上下文中，Zustand 订阅者的 React 重渲染不可靠（不触发或延迟触发），导致即使 store 已更新，UI 仍显示旧值。

## Solution

### 1. 移除 `!processConnected` 门控

`allDisabled` 不再包含 `!processConnected`。采集子进程未就绪时，用户可以直接点击按钮，通过后端 RPC 报错获取明确的失败原因。

### 2. React 桥接机制

新增共享模块 `src/hooks/systemStateBridge.ts`，提供模块级回调注册/触发机制：
- `useMqttConnect` 在 mount 时注册回调（React setState 封装）
- `router.ts` 的 `state_changed` handler 和 `sendStateRpcWithRetry` 在更新 Zustand store 后调用桥接触发

桥接触发 → React `setState` → `useMqttConnect` 重渲染 → `useEffect` 再次更新 store → 组件树整体重渲染 → StatusControlBar 读到新值。

## User Stories

1. As a user, I want the status bar buttons to work as soon as the device is online, so that I can operate the device immediately without refreshing.
2. As a user, I want to click buttons even when the collector subprocess hasn't started, and receive a clear error message, so that I know what to wait for.

## Implementation Decisions

### 受影响文件

| 文件 | 改动 | 描述 |
|------|------|------|
| `src/pages/Dashboard/StatusControlBar.tsx` | 1 行 | `allDisabled` 移除 `!processConnected` |
| `src/hooks/systemStateBridge.ts` | 新增 | 模块级桥接回调 |
| `src/hooks/useMqttConnect.ts` | 多处 | 引入桥接模块；`handleResult` 调用桥接 |
| `src/mqtt/router.ts` | 2 行 | `state_changed` handler 调用桥接 |
| `src/pages/Dashboard/StatusControlBar.test.tsx` | 1 行 | 更新测试：`processConnected=false` 时按钮不禁用 |

### `allDisabled` 变更

```typescript
// 变更前
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice || !processConnected;

// 变更后
const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice;
```

### 桥接架构

```
systemStateBridge.ts (共享模块)
  ├── setBridgeCallback(fn)    ← useMqttConnect 注册
  └── triggerSystemStateUpdate(state)  ← router.ts / handleResult 触发

调用链:
  router.ts state_changed  → applyState() → triggerSystemStateUpdate()
  handleResult             → applyState() → triggerSystemStateUpdate()
                                ↓
                          setBridgeCallback 回调
                                ↓
                          React setState → 重渲染 → useEffect → applyState()
```

### 双路径并行策略

`handleResult` 和 `state_changed` handler 均采用双路径：
- 路径 A：直接 `applyState()` 更新 Zustand（快路径，大多数情况有效）
- 路径 B：`triggerSystemStateUpdate()` 桥接 React 重渲染（兜底路径）

## Testing Decisions

### 已更新测试
- StatusControlBar.test.tsx：`processConnected=false` 时按钮应 `not.toBeDisabled()`

### 不新增测试
- `systemStateBridge.ts` — 纯模块级变量，无独立测试价值
- `router.ts` — 改动为追加一行桥接调用，其 state_changed handler 的 applyState 逻辑已有 tests 覆盖

## Out of Scope

- Zustand 订阅机制的根本性修复（这是 Zustand v5 + React 19 的已知兼容性问题）
- 其他 MQTT 回调路径的桥接（waveform、lowfreq 不需要重渲染触发）
