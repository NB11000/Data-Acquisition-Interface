# 数据采集与检测系统 V2.0 — 领域上下文

## 核心概念

- **设备 (Device)**: 一个独立的采集节点，包含硬件（采集卡 + 激光器）、MQTT 连接凭证、TLS 证书。每个设备注册在各自的 MQTT Broker 上，前端通过该 Broker 与设备间接通信。不同设备可能连接不同 Broker。
- **MachineId**: 设备的唯一标识符，对应 MQTT 主题中的 `{MachineId}` 段（也是 MQTT clientId），如 `daq-srv-01`。
- **Broker (MQTT 中心服务器)**: 消息中间件，设备和前端都连接同一 Broker，由 Broker 负责消息路由。
- **采集卡 (Collector)**: 硬件设备，负责 AD 采样。状态：已连接/已打开/采集中。
- **激光器 (Laser)**: 硬件设备，通过串口连接。状态：串口已连接/激光已开启。
- **RPC**: 前端通过请求-响应模式向设备下发命令的机制。请求主题 `$rpc/{MachineId}/{方法名}/{关联ID}`，响应主题 `$rpc/{MachineId}/{方法名}/{关联ID}/response`。
- **遗嘱消息 (Will Message)**: 设备进程崩溃时 Broker 代为发布的消息，主题 `daq/{MachineId}/events/will`，Retain=true。
- **连接池 (Connection Pool)**: 前端按连接参数分组维护多个 MQTT 连接，每个设备映射到一条连接上。见 [ADR 0002](docs/adr/0002-connection-pool.md)。

## 设备模型

```typescript
interface Device {
  id: string;            // MachineId, 唯一标识（也是 MQTT clientId）
  name: string;          // 显示名称
  brokerUrl: string;     // Broker 地址（含协议，如 mqtts://emqx.example.cn）
  port: number;          // Broker 端口（如 8883）
  username: string;      // MQTT 认证用户名
  password: string;      // MQTT 认证密码
  tls: boolean;          // 是否启用 TLS
  caCert?: string;       // CA 证书 PEM 内容（用户上传 .crt 文件后读取，tls=true 时有效）
  isOnline: boolean | null; // 运行时状态：true=在线, false=离线, null=未知（连接池中对应连接未建立）
}
```

> **注意**: `isOnline` 为 `null`（未知）表示该设备所属 Broker 的连接尚未建立。与"离线"（设备确实不在线）不同。

## 连接池

### 分组规则

连接参数 key = `brokerUrl:port:username:password`。key 相同的设备复用同一条 MQTT 连接。

`tls` 由 port 隐含（1883→非TLS, 8883→TLS），`caCert` 不进 key。

前端 MQTT clientId = `ui-client-{connectionKey}`。

### 生命周期

| 场景 | 行为 |
|------|------|
| **页面初始化** | 从 localStorage 恢复设备列表，按 key 分组，每组创建一条 MQTT 连接，订阅改组下所有设备的常驻主题 |
| **手动添加设备** | 先匹配已有连接分组——能复用则复用，否则新建连接；新连接建立后订阅该设备所有主题 |
| **删除设备** | 取消该设备所有订阅；若该连接上无其他设备，断开并销毁连接 |
| **编辑设备** | 若 key 不变则仅更新 localstorage；若 key 变更则从旧连接取消订阅（旧连接不受影响），挂到新连接 |
| **连接失败** | 弹错误提示，继续初始化/维持其他连接；失败连接上的设备 `isOnline = null` |

### 数据结构

```
Map<connectionKey, MqttClient>     // 连接池
Map<machineId, connectionKey>      // 设备到连接的逆向映射
```

## 主题订阅分类

### 常驻主题（连接建立后始终订阅，不随设备切换取消）

| 主题 | 理由 |
|------|------|
| `$SYS/brokers/+/clients/+/connected` | 监控该 Broker 下所有设备上线 |
| `$SYS/brokers/+/clients/+/disconnected` | 监控该 Broker 下所有设备下线 |
| `daq/{MachineId}/events/will` | Retain=true，需感知非选中设备的崩溃 |
| `daq/{MachineId}/events/state_changed` | 侧边栏实时显示所有设备状态 |
| `daq/{MachineId}/events/device_alarm` | Retain=true，告警与选中设备无关 |
| `$rpc/{MachineId}/+/+/response` | 保留可随时向任意设备发 RPC |

### 跟随切换主题（切设备时取消旧、订阅新）

| 主题 | 理由 |
|------|------|
| `daq/{MachineId}/waveform/ch1` | 16KB/100ms，高频高带宽，仅仪表盘展示 |
| `daq/{MachineId}/waveform/ch2` | 同上 |
| `daq/{MachineId}/lowfreq` | 仅仪表盘展示 |
| `daq/{MachineId}/detection/alerts` | 检测告警仅与当前查看设备相关 |

## 在线状态监控

- 通过 MQTT `$SYS` 主题实时获知设备上线/下线（Broker 下所有设备），不需要 HTTP API 轮询
- 若某条 Broker 连接未建立，其下设备的 `isOnline` 为 `null`（未知），侧边栏显示"未知"状态

## 持久化

设备列表（含 `caCert` PEM 内容和密码）存于 `localStorage`。页面刷新后自动恢复。

## 数据流

```
设备 → Broker → 前端（通过匹配的连接池连接订阅）
前端 → RPC 请求 → 通过设备对应的连接 → Broker → 设备
设备 → RPC 响应 → Broker → 前端对应连接 → 匹配关联ID
```

## 运行模式

- **Mock 模式**: 本地模拟 MQTT 数据（MockMqttClient），同样走连接池逻辑
- **Real 模式**: 连接真实 MQTT Broker
- 环境变量保留 `VITE_MQTT_MODE`（mock/real），废弃 `VITE_BROKER_URL`、`VITE_BROKER_USERNAME`、`VITE_BROKER_PASSWORD`、`VITE_DEFAULT_MACHINE_ID`
