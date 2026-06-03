# 数据采集与检测系统 V2.0 — 领域上下文

## 核心概念

### 实体

**MqttServer (MQTT 服务器)**:
一条物理或虚拟的 MQTT Broker 连接配置，包含地址、端口、认证凭据和 TLS 证书。前端为每个 MqttServer 维护一条独立的 MQTT 长连接。
_Avoid_: Broker 配置、连接配置

**Device (设备)**:
一台注册在某个 MqttServer 上的数据采集节点。Device 不携带连接配置，仅通过 serverId 引用其所属的 MqttServer。
_Avoid_: 机器、采集站

**MachineId**:
设备的唯一标识符，对应 MQTT clientId 和主题中的 `{MachineId}` 段，如 `daq-srv-01`。

**Connection Pool (连接池)**:
前端维护的 `Map<serverId, MqttClient>`，每个 MqttServer 分配一条 MQTT 连接。同服务器下的 Device 共享连接，跨服务器 Device 各自独立。
_Avoid_: 连接工厂

**Resident Topics (常驻主题)**:
连接建立后始终订阅、不随 Device 切换取消的 MQTT 主题。包括服务器级（通配符 will 状态主题）和设备级（state_changed、device_alarm、RPC 响应通配符）。

**Following Topics (跟随主题)**:
随当前选中 Device 切换而变更订阅的 MQTT 主题。包括波形、低频数据和检测告警。

**Online Client Cache (在线客户端缓存)**:
连接池内部维护的 `serverId → Set<clientId>` 映射，通过 `events/will` 消息的 `status` 字段实时更新，用于自动发现和在线状态查询。

### 数据模型

#### MqttServer

```typescript
interface MqttServer {
  id: string;            // 自生成 UUID
  name: string;          // 显示名称，如"生产环境"
  brokerUrl: string;     // 完整地址，含协议+主机+端口+路径（必填，如 mqtts://host.com:8883/mqtt）
  username: string;
  password: string;
  caCert?: string;       // CA 证书 PEM 内容；存在即视为启用 TLS
  connected: boolean;    // 运行时是否已连接（store 同步自 pool 状态）
  connectionState?: PoolConnectionState;  // 细粒度连接状态
}
```

#### Device

```typescript
interface Device {
  id: string;            // MachineId，唯一标识（也是 MQTT clientId）
  name: string;          // 显示名称
  serverId: string;      // 所属 MqttServer 的 UUID
  isOnline: boolean | null;  // 运行时状态
  lastEventType?: 'device_online' | 'device_offline' | 'process_crashed';  // 离/在线原因
}
```

> **设计约束**: 同一 MqttServer 下的所有 Device 共享同一组 MQTT 凭证。如需跨账号管理，将为前端分配专用 ACL 账号。

### 状态

**Device.isOnline**:
- `true`: 设备在线（通过 `events/will` 消息 `status:"online"` 确认）
- `false`: 设备离线（通过 `events/will` 消息 `status:"offline"` 确认）
- `null`: 未知（所属 MqttServer 连接未建立或已断开）

**Device.lastEventType**:
- `"device_online"`: 正常上线
- `"device_offline"`: 主动正常下线
- `"process_crashed"`: 崩溃（Broker Will 代发），前端据此显示红色告警态

**MqttServer 连接状态**:
- **已连接 (connected)**: 绿点，连接正常
- **已断开 (disconnected)**: 灰点，用户主动断开
- **重连中 (reconnecting)**: 黄点 + 旋转动画，第 N 次重试
- **连接失败 (failed)**: 红点 + 错误摘要（如"认证失败"）
- **初始化中 (initializing)**: 灰点 + 旋转动画

**Auto-reconnect**: 指数退避（1s → 2s → 4s），最多 3 次。超限后转入"连接失败"状态，系统设置页面出现手动 [重连] 按钮。

## 连接池

### 分组规则

连接 key = `serverId`。同一 serverId 的 Device 复用同一条 MQTT 连接。

前端 MQTT clientId = `ui-client-{serverId}`。

### 生命周期

| 场景 | 行为 |
|------|------|
| **页面初始化** | 并行加载 localStorage 中所有 MqttServer 和 Device；为每个 Server 并行建连；UI 立即渲染（逐个显示连接状态变化）。部分连接失败不影响全局，汇总 toast "N 台服务器中 M 台连接失败"。 |
| **新增服务器** | 创建连接，订阅 `daq/+/events/will` 通配符主题。若有已关联 Device，追加订阅其设备级常驻主题。 |
| **删除服务器** | 弹确认框（列出将被影响的 N 个 Device 名称），确认后断开并销毁连接，其下所有 Device 一并删除；取消所有重连 timer。 |
| **编辑服务器（仅改名称）** | 仅更新 localStorage 和 store，不重连。 |
| **编辑服务器（改连接参数）** | 弹确认框。若 Broker URL 变更，额外确认"是否移除该服务器下的 N 个设备？"。断开旧连接 → 用新配置建新连接 → 重新订阅所有 Device 常驻主题。 |
| **新增 Device（到已有服务器）** | 追加订阅该 Device 的 3 个设备级常驻主题（state_changed、device_alarm、RPC 响应）。 |
| **删除 Device** | 取消该 Device 的常驻主题订阅。若该服务器下再无 Device，断开并销毁连接。 |
| **设备切换（同服务器）** | 取消旧 Device 的跟随主题 → 订阅新 Device 的跟随主题；复用连接。 |
| **设备切换（跨服务器）** | 切换连接：源连接保留，取消旧 Device 跟随主题（若连接 alive）；目标连接订阅新 Device 跟随主题。 |
| **连接失败** | 不影响其他连接；该服务器下所有 Device `isOnline = null`，`lastEventType` 置空；具体错误信息（Broker 不可达/认证拒绝/TLS 失败/超时）展示在服务器卡片上。 |
| **重连成功** | 补订阅该服务器下所有 Device 的设备级常驻主题（不补跟随主题）。 |
| **重连期间设备切换** | unsubscribe 操作检查连接是否 alive，若已断则跳过。 |
| **页面关闭** | 不做任何处理，由 Broker keepalive 超时自然断开。 |

### 数据结构

```
Map<serverId, MqttClient>          // 连接池
Map<deviceId, serverId>            // Device 到 Server 的逆向映射
Map<serverId, Set<clientId>>       // 在线客户端缓存（从 events/will 消息维护）
```

## 主题订阅分类

### 服务器级常驻主题（新增服务器时订阅一次）

| 主题 | 用途 |
|------|------|
| `daq/+/events/will` | Retain=true，通配符订阅，监控该服务器下所有设备在线/离线/崩溃 |

### 设备级常驻主题（每新增/删除 Device 时增/减订阅）

| 主题 | 用途 |
|------|------|
| `daq/{MachineId}/events/state_changed` | 侧边栏实时显示所有设备状态 |
| `daq/{MachineId}/events/device_alarm` | Retain=true，告警 |
| `$rpc/{MachineId}/+/+/response` | RPC 响应 |

### 跟随主题（设备切换时取消旧、订阅新）

| 主题 | 用途 |
|------|------|
| `daq/{MachineId}/waveform/ch1` | 16KB/100ms 波形 |
| `daq/{MachineId}/waveform/ch2` | 波形 |
| `daq/{MachineId}/lowfreq` | 低频数据 |
| `daq/{MachineId}/detection/alerts` | 检测告警 |

## 在线状态监控

设备在线状态通过 `events/will` 主题的 retained 消息实现，不再依赖 `$SYS`。三种场景共用同一 topic，retained 覆盖保证最新状态：

| 场景 | status | eventType | 触发机制 |
|------|--------|-----------|---------|
| 设备上线 | `"online"` | `"device_online"` | 设备 CONNACK 后 publish |
| 设备正常下线 | `"offline"` | `"device_offline"` | 设备 DISCONNECT 前 publish |
| 设备崩溃 | `"offline"` | `"process_crashed"` | Broker 检测 keepalive 超时后代发 Will |

- 前端通过通配符 `daq/+/events/will` 订阅，连接时 Broker 立即推送所有 retained 消息（全量状态恢复），后续增量实时更新
- MachineId 从 topic 路径第二段提取 `daq/{MachineId}/events/will`，payload 不携带 deviceId
- 崩溃场景存在 ~45s 窗口期（keepalive 超时），此期间不做"疑似离线"处理
- 崩溃消息（`eventType:"process_crashed"`）触发 StatusControlBar 红色 Alert Banner，收到 `state_changed` 后自动清除
- 幂等：非崩溃消息按 `ts` 去重；崩溃消息按 `lastEventType` 去重
- 若某条服务器连接未建立，其下 Device 的 `isOnline` 为 `null`，`lastEventType` 同步置空

## RPC

- 请求主题: `$rpc/{MachineId}/{Method}/{CorrelationId}`
- 响应主题: `$rpc/{MachineId}/{Method}/{CorrelationId}/response`
- 路由逻辑封装在 RPC 层内部：传入 MachineId → 查 deviceMap 找到 serverId → 通过连接池 publish
- 10 秒超时
- 连接断开时所有 pending RPC 立即 reject（错误码 `CONNECTION_LOST`）

## 添加设备流程

1. 打开"添加设备"模态框 → 选择 MqttServer（下拉框，含 [+ 新增] 按钮）
2. 若服务器列表为空 → 模态框自动切到"添加 MQTT 服务器"界面 → 保存后回到添加设备
3. 两个方式并行可用：
   - **自动发现**: 读取 Online Client Cache（来自 `events/will` retained 消息），列出该服务器下当前在线客户端 ID
   - **手动添加**: 输入 Device ID + Name，不验证设备是否存在
4. 添加后持久化到 localStorage，订阅该 Device 的 3 个设备级常驻主题（state_changed、device_alarm、RPC 响应）

### MqttServer 去重

保存 MqttServer 时检查是否已存在相同 `brokerUrl:username` 的服务器，若有则拒绝并提示。

## 侧边栏

- Device 按 MqttServer 分组展示（树形结构，可展开/折叠）
- 设备状态图标：绿色圆点（在线）、灰色圆点（离线）、红色圆点（崩溃）、问号图标（未知/连接断开）
- 连接断开的服务器节点灰显，其下 Device 全部显示"未知"图标；默认展开
- 搜索：匹配的 Device 高亮，其所属服务器节点自动展开；无匹配的服务器节点隐藏；清空搜索恢复完整树

## 连接断开用户体验

- RPC 操作在连接断开时立即 reject，toast "服务器 {name} 未连接，请稍后重试"
- 仪表盘保留上一次数据的画面不变，数据区域顶部覆盖半透明 banner"连接已断开 —— 实时数据暂不可用"

## Mock 与 Real 解耦

- 依赖注入：App 入口根据 `VITE_MQTT_MODE` 选择 Mock 或 Real 工厂注入 ConnectionPool
- `MockMqttClient` 内建简易 topic router（`Map<topic, handler[]>`），subscribe/publish 行为与真实 MQTT 一致
- 代码树中不再出现 `if (MQTT_MODE === 'mock')` 分支

## 持久化

- `localStorage['mqttServers']` — `MqttServer[]` 序列化（含 caCert PEM 和密码）
- `localStorage['devices']` — `Device[]` 序列化
- 页面刷新后自动恢复

## 数据流

```
设备 → publish retained → Broker → 前端通配符订阅 daq/+/events/will → deviceStore 更新
设备 → Broker → 前端（通过对应 serverId 的连接池连接订阅波形/低频/检测等业务主题）
前端 → RPC 请求 → 查 deviceMap 找到 serverId → 通过对应连接 → Broker → 设备
设备 → RPC 响应 → Broker → 前端对应连接的 onMessage → RPC 层匹配 correlationId
```

## 运行模式

- **Mock 模式**: 本地模拟 MQTT 数据，通过依赖注入切换到 Mock 工厂
- **Real 模式**: 连接真实 MQTT Broker
- 环境变量仅保留 `VITE_MQTT_MODE`（mock/real）

## 迁移

首次加载时检测旧格式 Device（含 `brokerUrl` / `port` / `username` / `password` 字段），自动：
1. 提取所有唯一 Broker 配置 → 为每个生成 MqttServer
2. 将旧 Device 转换为新格式（剥离连接字段，绑定 serverId）
3. 写入新 localStorage key（`mqttServers` + `devices`），删除旧 key

## 示例对话

> **Dev:** "用户在建了 3 个 MqttServer 后点'添加设备'，下拉框显示 3 个选项和一个 [+ 新增] 按钮。选好服务器后自动发现列表显示 2 个在线设备。用户勾选添加这两台，也会手动输入 ID 添加一台离线设备。三台设备同属一个服务器，共享一条 MQTT 连接。"
> **Domain expert:** "对。切换设备时如果选的是同一服务器下的另一台，不新建连接，只做主题切换。如果选的是另一服务器的设备，切到那条连接上。原先的连接保留，继续监听设备上下线。"

## Flagged ambiguities

- "connection key" 曾指 `brokerUrl:port:username:password` 和 `serverId` 两种含义 → 已统一为 `serverId`。`port` 字段已从 MqttServer 移除，合并入 brokerUrl。
- ADR 0001 的"每设备独立配置"设计已被 ADR 0003 取代
- `events/will` 主题命名是历史遗留——实际承载在线/离线/崩溃三种事件，不限于 Will Message。因设备侧已完成对接，不做改名。
