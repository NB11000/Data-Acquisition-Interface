# Issue 7: 在线状态监控

## Execution Rules

> **此 Issue 为集成连线，不适用 TDD 流程。** 实现完成后通过手动验证确认 Acceptance Criteria。
>
> - 核心逻辑（Router $SYS 消息分发、ConnectionPool OnlineClientCache）已在 Issue 2/3 通过测试验证
> - 本 Issue 仅做展示层集成组装：Router → deviceStore.setOnline + 仪表盘 banner + RPC toast
> - 验证方式：Mock 模式下模拟 $SYS connected/disconnected 事件，确认侧边栏状态图标和仪表盘 banner 正确响应

## Parent

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 7

## What to build

实现 $SYS 主题的在线状态监控：每条连接独立监听 `$SYS/brokers/+/clients/+/connected` 和 `/disconnected`，更新对应 serverId 下的 Device.isOnline 和 OnlineClientCache。处理重连后 retain 消息回放。连接断开期间数据显示保持。

## Acceptance criteria

- [ ] Router 中注册 $SYS 消息处理：
  - `$SYS/.../connected` → 从 topic 提取 clientId → 更新 `pool.onlineClientCache[serverId].add(clientId)` → 查 deviceStore 该 serverId 下是否匹配该 clientId 的 Device → 有则 `deviceStore.setOnline(id, true)`
  - `$SYS/.../disconnected` → 同上逻辑 → `.delete(clientId)` → `deviceStore.setOnline(id, false)`
  - 闭包绑定的 serverId 确保只更新该 server 的设备
- [ ] 连接建立后 Broker 推送的 retain Will/Alarm 消息照单全收，不做特殊过滤
- [ ] 连接失败/断开时，该 server 下所有 Device `isOnline` 设为 `null`（未知）
- [ ] 仪表盘数据区在连接断开时保留上次数据不变 → 顶部显示半透明 banner "连接已断开 —— 实时数据暂不可用"
- [ ] RPC 操作在连接非 connected 状态时 immediate reject + toast "服务器 {name} 未连接，请稍后重试"

## Blocked by

Issue 6 (Sidebar — 在线状态图标显示), Issue 3 (Router+RPC)
