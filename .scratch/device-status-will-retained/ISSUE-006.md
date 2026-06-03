# Slice 6: UI 组件适配 — 崩溃态红色显示

> **标签**: needs-triage
> **日期**: 2026-06-03

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

## Parent

[Implementation Plan](IMPLEMENTATION-PLAN.md)

## What to build

4 个 UI 组件增加崩溃态（红色圆点/标签），依据 `device.lastEventType` 判断：

### Sidebar（`src/components/Sidebar.tsx`）

`DeviceStatusIcon` 四态渲染：

| isOnline | lastEventType | 图标 |
|----------|---------------|------|
| `true` | - | 绿色圆点 |
| `false` | `process_crashed` | **红色圆点** |
| `false` | `device_offline` 或 undefined | 灰色圆点 |
| `null` | - | QuestionCircleOutlined 灰色问号 |

### DeviceCard（`src/components/DeviceCard.tsx`）

修复现有 bug（`null` 被当离线显示红点），改为四态：

| isOnline | lastEventType | 显示 |
|----------|---------------|------|
| `true` | - | 绿色圆点 + "在线" |
| `false` | `process_crashed` | **红色圆点 + "崩溃"** |
| `false` | 其他 | 灰色圆点 + "离线" |
| `null` | - | 灰色圆点 + "未知" |

### Settings 设备表（`src/pages/Settings/index.tsx`）

设备在线状态 Tag 增加崩溃态：

| isOnline | lastEventType | Tag |
|----------|---------------|-----|
| `true` | - | `<Tag color="green">在线</Tag>` |
| `false` | `process_crashed` | `<Tag color="red">崩溃</Tag>` |
| `false` | 其他 | `<Tag>离线</Tag>` |
| `null` / server 断连 | - | `<Tag>未知</Tag>` |

### MqttStatusIndicator（`src/components/MqttStatusIndicator.tsx`）

当前三态（绿/红/灰），增加第四态：

| isOnline | lastEventType | 颜色 + 文案 |
|----------|---------------|------------|
| `true` | - | 绿色 + "设备在线状态 — 在线" |
| `false` | `process_crashed` | **红色 + "设备在线状态 — 崩溃"** |
| `false` | 其他 | 红色 + "设备在线状态 — 离线" |
| `null` / 无设备 | - | 灰色 + "设备在线状态 — 无设备" |

### StatusControlBar（`src/components/StatusControlBar.tsx`）

**仅验证**：Banner 只在收到 `process_crashed` 类型的 Will 消息时显示。当前逻辑应已正确（依赖 mqttStore.willReceived），Slate 3 的 router handler 已确保仅崩溃时调用 `setWill()`。若验证通过则不改代码。

## Acceptance criteria

- [ ] 4 个组件中 `process_crashed` 状态显示为红色（圆点/Tag/文案）
- [ ] DeviceCard 的 null → "未知" bug 已修复
- [ ] Sidebar 设备列表显示正确
- [ ] Settings 设备表 Tag 颜色正确
- [ ] `pnpm build` 类型检查通过

## Blocked by

ISSUE-002（不阻塞 ISSUE-003/004/005）
