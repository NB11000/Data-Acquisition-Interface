# PRD: system-state RPC 触发逻辑修复 — 离线设备不发RPC + 上线后自动补发

> **状态**: needs-triage
> **日期**: 2026-06-04

## Problem Statement

当前 system-state RPC 的触发逻辑存在两个缺陷：

1. **离线设备依然触发 RPC**：用户点击离线设备选项卡时，`useMqttConnect` 的设备切换 Effect 不检查 `device.isOnline`，无条件调用 `sendStateRpcWithRetry`。导致 RPC 发送 → 连接检查失败 reject → 3 秒重试 → 再次失败，前端反复弹出错误提示。

2. **设备上线后按钮不自动解灰**：设备从离线变为在线时，`events/will` 消息仅更新 `deviceStore.isOnline`，未链接触发 system-state RPC。结果 StatusControlBar 按钮保持置灰，用户必须手动重新切换设备 Tab 才能刷新。

## Solution

system-state RPC 触发由单一条件（`selectedId` 变化）改为双重条件（`selectedId` 变化 + `isOnline === true`）。新增 `isOnline` 从非 true 变 true 的监听 Effect，设备上线时自动补发 RPC。

## User Stories

1. As a user, I want clicking an offline device tab NOT to trigger system-state RPC, so that I don't see repeated error messages when browsing offline devices.
2. As a user, I want the status bar control buttons to automatically un-gray when a device goes online, so that I can operate the device immediately without manually switching tabs.
3. As a user, I want clicking an already-online device tab to still work as before, so that normal device switching is unaffected.

## Implementation Decisions

### 修改范围

仅修改 `src/hooks/useMqttConnect.ts`。

### 改动点

#### 1. 设备切换 Effect — 加 isOnline 检查

选择已在线设备时才发 system-state RPC，离线设备跳过（但依然执行清空 stores + 订阅主题切换）。

#### 2. 新增 isOnline 监听 Effect

监听当前选中设备的 `isOnline` 字段。当从 `false` 或 `null` 变为 `true` 时，补发 system-state RPC。使用 `useRef` 记录上一轮值实现去重（仅变化瞬间触发一次）。`selectedId` 变化时重置 ref。

#### 3. MQTT 重连路径加 isOnline 检查

`onStateChange` 回调中 `state === 'connected'` 和 StrictMode 兜底路径均增加 `device.isOnline` 检查。

#### 4. 入口不额外检查连接状态

`sendRpcCommand` 内置 `pool.isConnected` 检查，Effect 入口不做重复检查。

### 不做

- 不在 router.ts 的 will handler 中触发 RPC（保持 router 纯消息路由职责）
- 不在 StatusControlBar 中触发 RPC（保持纯渲染职责）
- 不新增 Zustand store

## Testing Decisions

### 必须测试

- **useMqttConnect hook**：设备切换 Effect 在 isOnline=false 时跳过 RPC、isOnline=true 时正常发 RPC
- **isOnline 监听 Effect**：从 false→true 触发 RPC、从 true→true 不触发、selectedId 变时 ref 重置

### 测试风格

- 通过 mock Zustand stores + mock RPC 层验证触发/不触发行为
- 不在本次范围测试 sendRpcCommand 内部逻辑（已有独立测试）

## Out of Scope

- sendRpcCommand 连接检查逻辑变更
- router.ts 变更
- UI 层变更
