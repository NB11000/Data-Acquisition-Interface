# PRD: 设备在线状态通过 Will Retained 消息实现

> **状态**: needs-triage
> **日期**: 2026-06-03
> **基于**: ADR-0005

## Problem Statement

当前前端通过 `$SYS/brokers/+/clients/+/connected|disconnected` 监控设备在线状态，存在两个致命缺陷：

1. **时序依赖导致状态丢失** — `$SYS` 消息无 retained 标志，仅瞬间发布。前端连接晚于设备或断线重连后，已发生的事件无法回溯，已在线设备永远显示为"离线/未知"。用户表现：添加设备时"自动发现"列表为空，侧边栏已在线设备始终显示离线。
2. **依赖 broker 类型** — `$SYS` 主题格式因 broker 而异（EMQX、Mosquitto、HiveMQ），换 broker 需改代码。

此外，前端无法区分"设备正常下线"和"主控进程崩溃"——两者都显示灰色离线态，运维人员无法第一时间感知崩溃。

## Solution

废弃 `$SYS` 主题，改用设备自身在 `daq/{MachineId}/events/will` 上发布的 **retained 消息** 实现在线状态监控。前端通过通配符 `daq/+/events/will` 一次性订阅，利用 retained 机制在连接瞬间获取全量状态、后续增量实时更新。

同一 topic 承载三种场景，保留 `isOnline` 三态语义，新增 `lastEventType` 字段区分离线原因：

| 场景 | isOnline | lastEventType | UI |
|------|----------|---------------|----|
| 设备上线 | `true` | `device_online` | 绿色圆点 |
| 正常下线 | `false` | `device_offline` | 灰色圆点 |
| 崩溃 | `false` | `process_crashed` | **红色圆点 + Alert Banner** |
| 服务器断连 | `null` | 置空 | 灰色问号 |

## User Stories

1. As a user, I want to see all devices' online status immediately when I open the app, so that I don't see "offline" for devices that were already online before I connected.
2. As a user, I want the device status to automatically recover after a page refresh or network reconnection, so that I never lose track of which devices are online.
3. As a user, I want to distinguish between a device that gracefully shut down and one that crashed, so that I can prioritize my response to crashed devices.
4. As a user, I want a visible red alert banner when a device crashes, so that I notice the incident immediately without actively monitoring.
5. As a user, I want the alert banner to auto-clear when the crashed device comes back online, so that I know the issue is resolved.
6. As a user, I want to discover online devices on a server to add them with one click, so that I don't need to type MachineId manually.
7. As a user adding a device, I want the auto-discovery list to work regardless of when I connected relative to the device, so that adding devices is reliable.
8. As a user, I don't want duplicate status updates or flickering when the same message is delivered multiple times, so that the UI is stable.
9. As a user, I want the "crashed" indicator to use the time when I detected the crash (not the zero-valued timestamp from the will payload), so that I see a meaningful time.

## Implementation Decisions

### 订阅模式

- 连接成功时一次性订阅 `daq/+/events/will`（qos=1），替代逐设备订阅 will 主题和 $SYS 订阅
- MachineId 从 topic 第二段提取：`daq/{MachineId}/events/will`，payload 不携带 deviceId
- 未注册到 deviceStore 的陌生 MachineId 消息直接丢弃

### Device 数据模型

- Device 新增 `lastEventType?: 'device_online' | 'device_offline' | 'process_crashed'` 字段
- `isOnline` 三态语义不变（true/false/null），`lastEventType` 解释离线原因
- 服务器断连/失败/重连中时，该服务器下所有 Device 的 `isOnline = null`，`lastEventType` 置空

### 消息处理

- router 中新增 `events/will` 完整 handler（解析 6 字段 payload），替换原有 $SYS handler 和简化版 Will handler
- 仅 `eventType: "process_crashed"` 触发 StatusControlBar 红色 Alert Banner；Banner 在收到该设备的 `state_changed` 或 online 消息后清除
- 正常上线/下线静默更新 deviceStore 和在线池

### 幂等处理

- 非崩溃消息（ts > 0）：比较新 ts 与已记录值，不大于则跳过
- 崩溃消息（ts === 0）：若该设备 `lastEventType` 已为 `process_crashed` 且未被恢复覆盖，则跳过
- 崩溃消息的 `ts` 和 `timestamp` 均为占位值/零值，前端使用本地收到消息的时间

### 异常场景

- **崩溃检测延迟 ~45s**（keepalive 超时窗口）：接受此限制，不做"疑似离线"
- **前端重连**：重新订阅 `daq/+/events/will`，Broker 推送全部 retained 消息，全量自动恢复
- **设备崩溃后重启**：设备 CONNACK 后 publish online retained 消息，覆盖崩溃 offline 残留

### 连接池变更

- 废弃 `subscribeSysTopics()` 的 $SYS 订阅，改为连接时订阅通配符 will 主题
- `subscribeDevice()` 管理的常驻主题从 4 个减为 3 个（移除 will），`unsubscribeDevice()` 同理
- 在线客户端缓存 `_onlineClients` 保留，但更新源从 $SYS 改为 `events/will` 消息的 `status` 字段
- `getOnlineClients()` API 签名不变，`AddDeviceModal` 自动发现无需改一行代码

### Mock 模式

- 模拟正常上线：连接成功时为每台已注册设备注入一条 status=online 的 retained 消息
- 不模拟崩溃场景

### 不再推送的事件

- `state_changed` 主题不再携带 `mqtt_connected` / `mqtt_disconnected` 事件（前端代码本无依赖）

### UI 组件

- Sidebar: 绿（在线）/ 灰（离线）/ 红（崩溃）/ 问号（未知）
- DeviceCard: 修复 null 被当离线的 bug + 增加红色崩溃态
- Settings 设备表: 增加 Tag 崩溃态
- MqttStatusIndicator: 增加崩溃态
- StatusControlBar: 仅 process_crashed 弹 Banner（验证现有逻辑）

### 主题命名

- 保持 `events/will` 命名不改——虽实际承载三种事件，但设备侧已按此名完成对接
- 新增常量 `allDevicesWillTopic()` 返回 `daq/+/events/will`

### 废弃删除

- 删除 `src/mqtt/router.ts` 中的 `onSysConnected` / `onSysDisconnected` 导出函数及内部回调变量
- 删除 `src/mqtt/topics.ts` 中的 `sysClientConnectedTopic` / `sysClientDisconnectedTopic` 函数
- 删除 `src/mqtt/router.test.ts` 中对应的测试用例

## Testing Decisions

### 必须测试

- **router.ts events/will handler**：topic 解析、6 字段 parse、status/eventType 三态分发、幂等去重（ts 和 lastEventType 两条路径）、Banner 触发（仅 process_crashed）、陌生 MachineId 丢弃
- **deviceStore setOnline**：`isOnline` 与 `lastEventType` 联动规则、断连时双字段重置

### 测试风格

- 通过公共接口验证行为，不耦合实现细节
- router handler 可纯函数隔离测试（mock 各 store 的 getState/setState）
- 测试文件与源文件同目录：`router.test.ts`（已有，修改）、`deviceStore.test.ts`（新增）

## Out of Scope

- 崩溃检测 ~45s 窗口期的"疑似离线"状态提示
- 多服务器跨 broker 通配符作用域问题（待后续讨论）
- 设备端改造（设备侧已完成）
- `state_changed` 主题中 MQTT 事件的移除（设备侧行为，前端无影响）
- 告警（device_alarm）处理逻辑变更

## Further Notes

- ADR-0005 记录本决策：`.scratch/device-status-will-retained/` → `docs/adr/0005-device-status-via-will-retained.md`
- CONTEXT.md 已同步更新
- 对接文档：`前端对接-设备在线状态监控.md`
- 方案文档：`通用设备在线监控方案.md`
