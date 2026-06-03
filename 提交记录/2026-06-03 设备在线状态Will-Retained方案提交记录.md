# 提交记录

> 生成时间：2026-06-03 14:25
> 仓库：数据采集与检测系统 V2.0
> 分支：`master`

---

## 一、背景（Background）

当前前端通过 `$SYS` 主题监控设备在线状态，存在两个致命缺陷导致用户体验问题。

### 问题（Problem）

#### 1. 时序依赖导致状态丢失

`$SYS` 消息无 retained 标志，仅在设备连接/断开瞬间发布一次。前端连接晚于设备或断线重连后，已在线设备永远显示为"离线/未知"。用户表现：添加设备时"自动发现"列表为空，侧边栏已在线设备始终显示离线。

#### 2. 依赖 broker 类型

`$SYS` 主题格式因 broker 而异（EMQX、Mosquitto、HiveMQ），换 broker 需改代码。

#### 3. 无法区分崩溃与正常下线

设备正常关机和主控进程崩溃在前端 UI 中显示相同的灰色离线态，运维人员无法第一时间感知崩溃。

#### 4. 系统耦合度高

在线状态涉及 $SYS 订阅、逐设备 will 订阅、在线客户端缓存三套机制并行，消息路由中需处理优先级和冲突。

---

## 二、解决方案（Solution）

### 整体思路

废弃 `$SYS` 主题，改用设备自身在 `daq/{MachineId}/events/will` 上发布的 **retained 消息** 实现在线状态监控。前端通过通配符 `daq/+/events/will` 一次性订阅，利用 retained 机制在连接瞬间获取全量状态、后续增量实时更新。同一 topic 承载三种事件（上线/正常下线/崩溃），Device 模型新增 `lastEventType` 和 `lastTs` 字段区分离线原因。

### 具体实施

#### 1. 类型体系重建

新增 `DeviceStatusPayload` 接口（6 字段：status/ts/eventType/source/message/timestamp），替换旧的 `WillMessage`。Device 接口新增 `lastEventType` 和 `lastTs` 字段，`setOnline` 扩展为三参数签名（id, online, lastEventType?）。

```typescript
interface DeviceStatusPayload {
  status: "online" | "offline";
  ts: number;
  eventType: "device_online" | "device_offline" | "process_crashed";
  source: "device" | "mqtt_broker";
  message: string;
  timestamp: string;
}
```

#### 2. 消息路由全量重写

删除 $SYS handler（含 `_onSysConnected`/`_onSysDisconnected` 回调）、废弃 `setupMqttRouter` 单连接版、旧简化 Will handler。新增完整 `events/will` handler：

```
topic 匹配 → 提取 MachineId → 查 deviceStore → 三态分发：
  ├─ online → setOnline(true, device_online) + addOnlineClient + clearWill
  ├─ process_crashed → setOnline(false, process_crashed) + setWill + removeOnlineClient
  └─ device_offline → setOnline(false, device_offline) + removeOnlineClient
```

幂等保护：非崩溃消息按 `ts` 比较（≤ 跳过），崩溃消息按 `lastEventType` 比较（已是 process_crashed 则跳过）。

#### 3. 连接池简化

移除 `subscribeSysTopics()` 方法（两个 $SYS 通配符订阅），改为连接时订阅 `daq/+/events/will`。`subscribeDevice`/`unsubscribeDevice` 管理的常驻主题从 4 个减为 3 个（移除逐设备 will 主题订阅）。

#### 4. Mock 生成器适配

从注入 `$SYS connected` 消息改为注入 `events/will` retained online 消息（完整 `DeviceStatusPayload` 格式）。`MockMqttClient.topicMatches` 已有 `+` 通配符支持，无需修改。

#### 5. UI 四态崩溃显示

Sidebar、DeviceCard、Settings、MqttStatusIndicator 四个组件从三态扩展为四态：

| isOnline | lastEventType | UI |
|----------|---------------|----|
| `true` | - | 绿色圆点 |
| `false` | `process_crashed` | **红色圆点 / Tag(#ff4d4f)** |
| `false` | 其他 | 灰色圆点 |
| `null` | - | 灰色问号 |

同步修复 DeviceCard 将 `null` 当作 "离线" 的 bug。

#### 6. 测试覆盖

新增 `deviceStore.test.ts`（5 场景）和扩写 `router.test.ts`（9 场景），共 14 个新测试用例。`connectionPool.test.ts` 适配 subscribeDevice 4→3。

---

## 三、Git 提交消息

```
feat(mqtt): 设备在线状态改用 Will Retained 消息替代 $SYS 主题
```

**正文：**

1. 新增 DeviceStatusPayload 类型，Device 接口增加 lastEventType/lastTs 字段
2. Router 全量重写：删除 $SYS handler，新增 events/will 三态分发+幂等+Banner
3. ConnectionPool 简化为通配符订阅 daq/+/events/will，remove $SYS，subscribeDevice 4→3
4. Mock 生成器从 $SYS 注入改为 events/will retained online 消息注入
5. UI 四组件增加红色崩溃态显示，修复 DeviceCard null=离线 bug

---

## 四、本次提交详情

### 基本信息

| 字段 | 内容 |
|------|------|
| **提交时间** | 2026-06-03 14:25 |
| **作者** | NB11000 |
| **基于提交** | `050d87e` — feat(theme): 默认暗色主题 + 主题系统统一重构 (2026-06-02 20:55) |
| **变更统计** | 26 files changed, +1562 insertions, -258 deletions |

### 核心变更文件清单

| 状态 | 文件路径 | 变更说明 |
|------|----------|----------|
| 新增 | `src/mqtt/types.ts` | 新增 DeviceStatusPayload 6 字段接口（+10 行） |
| 新增 | `src/stores/deviceStore.test.ts` | 5 个 setOnline/lastEventType 测试（+66 行） |
| 修改 | `src/stores/deviceStore.ts` | Device 新增 lastTs/lastEventType 字段，setOnline 三参数（+15/-4 行） |
| 修改 | `src/mqtt/router.ts` | 删除 $SYS handler/废弃 setupMqttRouter，新增完整 events/will handler（+58/-148 行） |
| 修改 | `src/mqtt/connectionPool.ts` | 通配符 will 替代 $SYS，subscribeDevice 4→3，删除 subscribeSysTopics（+6/-11 行） |
| 修改 | `src/mqtt/topics.ts` | 删除 sysClient*Topic，新增 allDevicesWillTopic（+4/-8 行） |
| 修改 | `src/mqtt/router.test.ts` | 删除 $SYS 测试，新增 9 个 events/will 测试（+260/-50 行） |
| 修改 | `src/mqtt/connectionPool.test.ts` | 适配 subscribeDevice 4→3（+2/-3 行） |
| 修改 | `src/hooks/useMockGenerators.ts` | $SYS 注入改为 events/will online 注入（+26/-24 行） |
| 修改 | `src/components/Sidebar.tsx` | DeviceStatusIcon 增加红色崩溃态（+5/-2 行） |
| 修改 | `src/components/DeviceCard.tsx` | 四态显示 + 修复 null bug（+18/-2 行） |
| 修改 | `src/pages/Settings/index.tsx` | 设备表 Tag 增加红色崩溃态（+8/-4 行） |
| 修改 | `src/components/MqttStatusIndicator.tsx` | 增加已崩溃文案（+4/-2 行） |
| 修改 | `CONTEXT.md` | 在线状态监控/常驻主题/自动发现等 8 处改写（+53/-18 行） |
| 新增 | `docs/adr/0005-device-status-via-will-retained.md` | ADR-0005 决策记录（+52 行） |

---

## 五、架构影响

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| 在线状态数据源 | `$SYS/brokers/…` broker 系统主题 | `daq/+/events/will` retained 消息 |
| 订阅模式 | $SYS 通配符 + 逐设备 will | 单通配符 `daq/+/events/will` |
| Device 模型 | `isOnline: boolean \| null` | +`lastEventType`、+`lastTs` |
| 设备常驻主题数 | 4（will + state_changed + alarm + RPC） | 3（state_changed + alarm + RPC） |
| 消息路由优先级 | $SYS > RPC > state_changed > will > … | RPC > events/will > state_changed > … |
| 崩溃感知 | 无区分 | 红色圆点/Banner + lastEventType |
| 自动发现数据源 | $SYS onlineClients 缓存 | retained 在线池（API 不变） |

---

## 六、审核报告

> 审查范围：`router.ts`、`connectionPool.ts`、`deviceStore.ts`、`types.ts`、UI 组件

### 通过项

| # | 检查点 | 详情 |
|---|--------|------|
| 1 | 类型安全 | `pnpm build` tsc 类型检查通过，无 any/隐式类型 |
| 2 | 测试覆盖 | 77 个测试全部 PASS（14 个新增），覆盖上线/下线/崩溃/幂等/陌生设备 |
| 3 | 向后兼容 | `setOnline(id, bool)` 二参数调用仍兼容（第三参数可选） |
| 4 | 崩溃幂等 | 双路径去重：ts 比较（正常）+ lastEventType（崩溃），ts=0 合法处理 |
| 5 | Mock 通配符 | MockMqttClient.topicMatches 已支持 `+` 匹配，无需修改 |

### 已修复问题

| # | 严重度 | 位置 | 问题描述 | 修复 |
|---|--------|------|----------|------|
| 1 | 中 | `DeviceCard.tsx:22` | `device.isOnline === null` 显示为 "离线" 而非 "未知" | 四态分支增加 null 判断 |
| 2 | 低 | `Settings/index.tsx:250` | Tag `color="default"` 属性冗余 | 移除默认颜色，简化标签 |

### 遗留建议（非阻塞）

| # | 严重度 | 位置 | 建议 |
|---|--------|------|------|
| 1 | 低 | `router.ts` | `lastTs` 存储于 deviceStore，断连时不重置。如未来需要跨 session 持久化，可纳入 localStorage 序列化 |

---

## 七、后续步骤预览（不在本次范围）

- 多服务器跨 broker 通配符作用域验证（标记待讨论）
- 崩溃检测 ~45s 窗口期的"疑似离线"状态提示
- 设备端 Will 消息完整性测试（正常上线/正常下线/崩溃三种场景联调）
