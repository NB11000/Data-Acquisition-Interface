# Issue 5: 系统设置页面

## Execution Rules

> **此 Issue 为 UI 组件实现，不适用 TDD 流程。** 实现完成后通过手动验证确认 Acceptance Criteria。
>
> - Settings 页面是纯展示层，依赖 Ant Design Card/Table 组件和 MqttServerModal（Issue 4）
> - 核心业务逻辑（ConnectionPool 生命周期、serverStore CRUD）已在 Issue 2 通过测试验证
> - 验证方式：浏览器中打开设置页面，确认服务器卡片连接状态正确、设备列表 CRUD 正常

## Parent

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 5

## What to build

实现系统设置页面：MQTT 服务器管理列表（5 种连接状态 + 错误信息）和 Device 列表（含所属服务器、在线状态、删除操作）。替换现有的 stubbed Settings 页面。

## Acceptance criteria

- [ ] `src/pages/Settings/index.tsx` 重写：
  - **MQTT 服务器管理区域**：
    - 卡片列表，每张卡片显示：名称、brokerUrl:port、连接状态图标（5 态：初始化中灰点旋转/已连接绿点/已断开灰点/重连中黄点旋转+N/连接失败红点+错误摘要）、关联设备数
    - [编辑] 按钮 → 打开 MqttServerModal（编辑模式）
    - [删除] 按钮 → 确认框（列出 N 个关联 Device 名称）→ pool.destroy() + serverStore.removeServer() + deviceStore 移除所有关联 device
    - [连接] 按钮 → 仅出现于"已断开"和"连接失败"状态，手动触发 pool.create(reconnect)
    - [+ 添加 MQTT 服务器] 按钮 → 打开 MqttServerModal（新增模式）
  - **设备列表区域**：
    - 表格：Device ID、名称、所属服务器名称、在线状态（在线/离线/未知图标）、[删除] 按钮
    - [删除] 按钮 → deviceStore.removeDevice() + pool.unsubscribeDevice()
  - 订阅 `pool.onStateChange` 实时更新服务器连接状态
- [ ] `src/pages/Settings/MqttServerForm.tsx` 可复用表单组件

## Blocked by

Issue 4 (AddDeviceModal — 共享 MqttServerModal 组件), Issue 2 (ConnectionPool)
