# 多服务器 MQTT 连接架构设计

## 概述

将前端从"单设备-单连接"架构重构为"多服务器-多连接"架构。前端为每一个它所连接的 MQTT 服务器分配一个 MQTT 连接，同服务器下的设备共享连接，不同服务器下的设备各自独立连接。

## 数据模型

### MqttServer

```typescript
interface MqttServer {
  id: string;            // 自生成 UUID
  name: string;          // 显示名称，如"生产环境"
  brokerUrl: string;     // mqtt://192.168.1.100 或 mqtts://...
  port: number;          // 1883 或 8883
  username: string;
  password: string;
  tls: boolean;
  caCert?: string;       // CA 证书 PEM 内容
  isConnected: boolean | null;  // 运行时状态
}
```

### Device

```typescript
interface Device {
  id: string;            // MachineId, 如 daq-srv-01
  name: string;          // 显示名称，如"1号采集站"
  serverId: string;      // 所属 MQTT 服务器 ID
  isOnline: boolean | null;  // 运行时状态
}
```

### 持久化

- `localStorage['mqttServers']` — `MqttServer[]` 序列化
- `localStorage['devices']` — `Device[]` 序列化
- 页面刷新后自动恢复，依据服务器列表重建连接池

## 连接架构

### 连接池

```
Map<serverId, MqttClient>     // 每台服务器一个独立 MQTT 连接
Map<deviceId, serverId>       // 设备 → 服务器的逆向映射
```

连接参数 key = `serverId`。不同服务器独立连接。

### 生命周期

| 场景 | 行为 |
|------|------|
| **页面初始化** | 并行从 localStorage 恢复 MqttServer 和 Device 列表；为每个 Server 并行建连（不等所有就绪）；UI 立即渲染，逐个显示各服务器连接状态变化。部分连接失败不影响全局，汇总 toast "N 台服务器中 M 台连接失败"。 |
| **新增服务器** | 创建连接，订阅 $SYS 主题。若已有关联 Device，追加订阅其常驻主题。保存时检查 `brokerUrl:port:username` 去重，若有重复则拒绝并提示。 |
| **删除服务器** | 弹确认框（列出将被影响的 N 个 Device 名称）。确认后断开并销毁连接，所有关联 Device 一并删除；取消所有重连 timer。 |
| **编辑服务器（仅改名称）** | 热更新：仅更新 localStorage 和 store，不重连。 |
| **编辑服务器（改连接参数）** | 弹确认框。若 Broker URL 变更，额外弹出"是否移除该服务器下的 N 个设备？"选择。用户确认后：断开旧连接 → 用新配置创建新连接 → 重新订阅常驻主题。 |
| **新增 Device（到已有服务器）** | 追加订阅该 Device 的 4 个设备级常驻主题（will / state_changed / device_alarm / RPC 响应通配符）。 |
| **删除 Device** | 取消该 Device 的常驻主题订阅。若该服务器下再无 Device，断开并销毁连接（释放资源）。 |
| **设备切换（同服务器）** | 取消旧 Device 的跟随主题 → 订阅新 Device 的跟随主题；复用连接（微秒级）。 |
| **设备切换（跨服务器）** | 源连接保留（继续监听在线/离线）；若源连接 alive 则取消旧 Device 跟随主题，否则跳过；目标连接订阅新 Device 跟随主题。 |
| **连接失败** | 不影响其他连接；该服务器下所有 Device `isOnline = null`；具体错误类型（Broker 不可达/认证拒绝/TLS 失败/超时）展示在服务器卡片上。 |
| **连接断开（用户主动）** | 连接标记为"已断开"状态，设备 `isOnline` 全部设为 `null`。用户可在系统设置页面手动 [连接]。 |
| **重连成功** | 补订阅该服务器下所有 Device 的设备级常驻主题。不补跟随主题（当前选中设备可能已切换）。 |
| **重连期间设备切换** | unsubscribe 操作检查连接是否 alive，若已断则跳过不抛错。 |
| **页面关闭** | 不做任何处理，由 Broker keepalive 超时自然断开。 |

### 主题订阅分类

#### 常驻主题（连接建立后始终订阅，不随设备切换取消）

| 主题 | 用途 |
|------|------|
| `$SYS/brokers/+/clients/+/connected` | 监控该服务器下所有设备上线 |
| `$SYS/brokers/+/clients/+/disconnected` | 监控该服务器下所有设备下线 |
| `daq/{MachineId}/events/will` | Retain=true，感知设备崩溃 |
| `daq/{MachineId}/events/state_changed` | 侧边栏实时显示所有设备状态 |
| `daq/{MachineId}/events/device_alarm` | Retain=true，告警 |
| `$rpc/{MachineId}/+/+/response` | RPC 响应 |

#### 跟随主题（切换设备时取消旧、订阅新）

| 主题 | 用途 |
|------|------|
| `daq/{MachineId}/waveform/ch1` | 16KB/100ms 波形 |
| `daq/{MachineId}/waveform/ch2` | 波形 |
| `daq/{MachineId}/lowfreq` | 低频数据 |
| `daq/{MachineId}/detection/alerts` | 检测告警 |

### 在线状态

- 通过 `$SYS/brokers/+/clients/+/connected` 和 `$SYS/brokers/+/clients/+/disconnected` 实时监控
- 连接未建立的服务器，其下设备 `isOnline = null`
- 连接断开但未销毁的服务器，设备标记为离线

### 连接状态机

MqttServer 连接 5 种状态：

| 状态 | 图标 | 触发条件 |
|------|------|----------|
| **初始化中** | 灰点 + 旋转 | 连接正在建立（TLS 握手期间） |
| **已连接** | 绿点 | 连接建立成功 |
| **已断开** | 灰点 | 用户主动点击"断开" |
| **重连中** | 黄点 + 旋转 + 第 N 次 | 连接异常断开，自动重试中 |
| **连接失败** | 红点 + 错误摘要 | 3 次重试耗尽，永久断开 |

### 自动重连策略

- 指数退避间隔：1s → 2s → 4s
- 上限 3 次
- 超限后转入"连接失败"状态，出现手动 [重连] 按钮
- 删除服务器时取消所有 pending 重连 timer

### 连接断开时的 UX

- RPC 操作在连接断开时立即 reject，toast "服务器 {serverName} 未连接"
- 仪表盘保留上次数据不变（避免画面闪烁），数据区覆盖半透明 banner"连接已断开 —— 实时数据暂不可用"

## 添加设备模态框

### 布局

```
┌───────────────────────────────────────┐
│  添加设备                          ✕  │
├───────────────────────────────────────┤
│  选择 MQTT 服务器: [下拉框 ▾]  [+ 新增] │
│                                       │
│  ┌─ 自动发现 ──────────────────────┐  │
│  │  正在扫描服务器上的在线设备...    │  │
│  │  ☑ daq-srv-01  1号采集站        │  │
│  │  ☐ daq-srv-02  2号采集站        │  │
│  │  [确认添加选中的设备]            │  │
│  └─────────────────────────────────┘  │
│                                       │
│  ┌─ 手动添加 ──────────────────────┐  │
│  │  设备 ID:  [________________]    │  │
│  │  设备名称: [________________]    │  │
│  │  [添加]                          │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### 操作流程

1. 下拉框选择已有 MQTT 服务器，或点 [+ 新增] 打开子模态框添加
2. 选择服务器后，两个 Tab/区域可用：
   - **自动发现**: 通过 `$SYS/brokers/+/clients/+/connected` 收集在线客户端 ID，展示为可选列表，勾选后确认添加
   - **手动添加**: 输入设备 ID + 显示名称，点击添加
3. 添加后设备存入 localStorage，订阅该设备的常驻主题

### 新增服务器子模态框

```
┌───────────────────────────────────────┐
│  添加 MQTT 服务器                  ✕  │
├───────────────────────────────────────┤
│  名称:        [________________]      │
│  地址:        [192.168.1.100    ]     │
│  端口:        [1883          ▾]       │
│  用户名:      [________________]      │
│  密码:        [________________]       │
│  □ 启用 TLS                          │
│    CA 证书: [上传文件] (可选)         │
│                                       │
│  [测试连接]  [保存]                    │
└───────────────────────────────────────┘
```

- 保存后持久化到 localStorage，立即创建 MQTT 连接
- "测试连接"按钮验证连接是否可用

## 侧边栏

- Device 按 MqttServer 分组展示（树形结构，可展开/折叠）
- 连接断开的服务器节点灰显，其下 Device 全部"未知"图标，默认展开
- 全局搜索：匹配的 Device 高亮，其所属服务器自动展开；无匹配服务器隐藏；清空搜索恢复完整树

## RPC 路由

- RPC 层内部封装路由：`sendRpcCommand(machineId, method)` → 查 deviceMap 找到 serverId → 通过 connectionPool 取得对应 MqttClient → publish
- 调用方只传 machineId 和 method，不感知连接池
- 超时 10 秒
- 连接断开时 pending RPC 立即 reject（错误码 `CONNECTION_LOST`），不等待超时

## Mock / Real 依赖注入

- 所有 MQTT 交互通过 `MqttClientLike` 接口，Mock 和 Real 各自独立实现
- `MockMqttClient` 内建简易 topic router（`Map<topic, handler[]>`），subscribe/publish 行为与真实 MQTT 一致
- App 入口根据 `VITE_MQTT_MODE` 选择工厂注入 ConnectionPool
- 全代码树无 `if (MQTT_MODE === 'mock')` 分支
- 环境变量仅保留 `VITE_MQTT_MODE`，废弃其余（`VITE_BROKER_URL` / `VITE_BROKER_USERNAME` / `VITE_BROKER_PASSWORD` / `VITE_DEFAULT_MACHINE_ID`）

## 系统设置页面

### MQTT 服务器管理

```
┌──────────────────────────────────────────────────┐
│  系统设置                                         │
├──────────────────────────────────────────────────┤
│  ┌─ MQTT 服务器管理 ──────────────────────────┐  │
│  │                                            │  │
│  │  ● 生产环境    mqtt://192.168.1.100:1883    │  │
│  │     已连接    3 台设备           [编辑][删除]│  │
│  │                                            │  │
│  │  ○ 测试服务器  mqtt://10.0.0.50:1883        │  │
│  │     已断开    0 台设备           [编辑][删除]│  │
│  │                                            │  │
│  │           [+ 添加 MQTT 服务器]               │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  ┌─ 设备列表 ──────────────────────────────────┐  │
│  │                                            │  │
│  │  daq-srv-01  1号采集站  生产环境  ● 在线  [删除]│
│  │  daq-srv-02  2号采集站  生产环境  ● 在线  [删除]│
│  │                                            │  │
│  └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
```

### 功能
- 服务器列表：名称、brokerUrl、连接状态、关联设备数
- 每项可编辑（修改配置后重连）和删除（确认后销毁连接并移除关联设备）
- 设备列表：设备 ID、名称、所属服务器、在线状态、删除操作

## 文件结构变更

```
src/
├── stores/
│   ├── serverStore.ts        ← 新增：MQTT 服务器列表 + 连接状态
│   └── deviceStore.ts        ← 改造：设备模型简化，关联 serverId
├── mqtt/
│   ├── client.ts             ← 改造：从单例 → 连接池工厂
│   ├── connectionPool.ts     ← 新增：连接池管理
│   ├── connectionFactory.ts  ← 新增：接口定义 + Mock/Real 工厂
│   ├── mqttClientLike.ts     ← 新增：MqttClientLike 接口
│   ├── mockClient.ts         ← 改造：MockMqttClient 内建 topic router
│   ├── router.ts             ← 改造：支持多连接路由
│   ├── rpc.ts                ← 改造：支持按 serverId 发送，内部分发路由
│   ├── topics.ts             ← 保留：主题常量
│   └── types.ts              ← 保留：类型定义
├── pages/
│   └── Settings/
│       ├── index.tsx          ← 改造：添加服务器管理 + 设备列表
│       └── MqttServerForm.tsx ← 新增：服务器表单组件（可复用）
├── components/
│   ├── sidebar/
│   │   └── index.tsx          ← 改造：按服务器分组展示
│   └── modals/
│       ├── AddDeviceModal.tsx ← 新增：合并的添加设备模态框
│       └── MqttServerModal.tsx← 新增：添加/编辑服务器模态框
└── hooks/
    └── useMqttConnect.ts     ← 改造：适配连接池
```

## 实施顺序

1. **数据模型与持久化** — 定义 MqttServer + Device 新模型，serverStore，更新 deviceStore
2. **连接池核心** — connectionPool.ts + connectionFactory.ts + mqttClientLike.ts，Mock/Real 依赖注入
3. **MQTT 路由改造** — router/rpc 适配多连接，RPC 内部路由
4. **添加设备模态框** — AddDeviceModal + MqttServerModal（含自动发现、手动添加、服务器列表为空时的引导）
5. **系统设置页面** — 服务器管理（含 5 种连接状态 + 错误分类）+ 设备列表
6. **侧边栏改造** — 按服务器分组、树形折叠、全局搜索
7. **设备切换逻辑** — 同服务器/跨服务器切换，跟随主题管理
8. **在线状态监控** — $SYS 事件处理（闭包绑定 serverId）+ Online Client Cache
9. **自动迁移** — 旧格式 Device 数据自动转为新格式
10. **环境变量清理** — 移除 VITE_BROKER_URL / VITE_BROKER_USERNAME / VITE_BROKER_PASSWORD / VITE_DEFAULT_MACHINE_ID

## 迁移说明

### 自动迁移

首次加载时检测 localStorage 中是否存在旧格式 Device（含 `brokerUrl` / `port` / `username` / `password` 字段），若存在则自动执行：

1. 提取所有唯一 Broker 配置 → 为每个生成 MqttServer（UUID + "默认服务器 N"）
2. 将旧 Device 转换为新格式：剥离连接字段，绑定对应的 `serverId`，保留 `id` / `name`
3. 写入新 localStorage key（`mqttServers` + `devices`），删除旧 key
4. 后续正常运行（从新 key 恢复数据）

### 向后不兼容

新架构下 Device 不再自带连接配置。外部脚本或手动编辑的 localStorage 旧格式数据将不再被识别。
