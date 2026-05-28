# PRD: MQTT 连接池与设备管理重构

**日期**: 2026-05-29
**Status**: needs-triage
**替代**: PRD-001

---

## Problem Statement

PRD-001 的"单连接 + 切换时断连重连"方案存在根本缺陷：

1. 单连接下无法同时监控不同 Broker 上的设备在线状态（侧边栏需要实时显示所有设备在线/离线）
2. 切换不同 Broker 的设备需 TLS 握手重连（~1-2s 延迟），体验差
3. 不同设备可能使用不同 MQTT 账号（ACL 隔离），单连接无法解决账号权限互斥
4. 非选中设备的遗嘱消息和报警消息（Retain=true）无法感知
5. 设备连接参数（brokerUrl/port/username/password）已存在 Device 模型中但从未用于实际 MQTT 连接

## Solution

将 MQTT 连接管理从"单连接"改为**连接池（Connection Pool）**架构：前端按连接参数分组维护多条 MQTT 长连接，所有连接常驻不随设备切换销毁。设备切换仅做主题订阅切换。在线状态通过 MQTT `$SYS` 主题实时监控，不再依赖 HTTP API 轮询。

---

## User Stories

1. As a 运维人员, I want 手动添加设备时填写完整 MQTT 连接信息并上传 CA 证书, so that 每个设备能独立连接各自的 Broker
2. As a 运维人员, I want 新设备添加后自动匹配已有连接池（同 Broker 同账号则复用）, so that 不需要理解连接复用逻辑
3. As a 运维人员, I want 侧边栏实时显示所有设备在线/离线/未知状态, so that 一目了然所有设备健康度
4. As a 运维人员, I want 不同 Broker 的设备在线状态同时被监控, so that 设备宕机时立刻看到
5. As a 运维人员, I want 点击切换设备时无延迟感（同 Broker 仅换主题）, so that 操作流畅
6. As a 运维人员, I want 切换设备时不同 Broker 自动走对应连接，无需手动操作, so that 无需关心连接所属
7. As a 运维人员, I want 某个 Broker 连接失败时不影响其他已建立的连接, so that 单点 Broker 故障不全局崩溃
8. As a 运维人员, I want 连接失败的 Broker 下设备状态显示"未知"而非"离线", so that 能区分"设备真的离线"和"前端连不上 Broker"
9. As a 运维人员, I want 删除设备后若对应连接无其他设备则自动断开释放资源, so that 不需要手动管理连接
10. As a 运维人员, I want 编辑设备连接参数后设备自动挂到匹配的连接上, so that 配置变更后立即生效
11. As a 运维人员, I want 刷新页面后设备列表（含连接参数和 CA 证书）自动恢复, so that 不需要每次重新添加
12. As a 运维人员, I want 编辑设备名称时不触发任何连接变更, so that 纯显示名称的修改不被干扰
13. As a 运维人员, I want Mock 模式下同样走连接池逻辑, so that Mock 和 Real 模式代码路径一致
14. As a 运维人员, I want 移除设备后不中断其他设备的数据流, so that 删除操作不影响日常监控

---

## Implementation Decisions

### 架构决策

| 决策 | 内容 | 理由 |
|------|------|------|
| 连接池分组 key | `brokerUrl + port + username + password` | tls 由 port 隐含；caCert 同 Broker 下一致不进 key |
| 前端 MQTT clientId | `ui-client-{connectionKey}` | 不与设备 MachineId 冲突 |
| 在线状态来源 | MQTT `$SYS` 主题 | 实时推送，不需要 HTTP API 轮询 |
| 连接失败处理 | 弹错误提示，继续初始化其他连接 | 不阻塞其他正常 Broker |
| isOnline 可空 | `boolean \| null`，null=未知 | 区分"真正离线"和"前端连不上" |
| 环境变量 | 仅保留 `VITE_MQTT_MODE` | 废弃 BROKER_URL/USERNAME/PASSWORD/DEFAULT_MACHINE_ID |
| 持久化 | localStorage | 含 CA 证书 PEM 和密码 |
| HTTP API | 完全废弃 | 不在实现范围内 |

### 主题分类

**常驻主题**（连接建立后始终订阅）:
- `$SYS/brokers/+/clients/+/connected`
- `$SYS/brokers/+/clients/+/disconnected`
- `daq/{MachineId}/events/will`
- `daq/{MachineId}/events/state_changed`
- `daq/{MachineId}/events/device_alarm`
- `$rpc/{MachineId}/+/+/response`

**跟随切换主题**（选中设备变化时取消旧订阅新）:
- `daq/{MachineId}/waveform/ch1`
- `daq/{MachineId}/waveform/ch2`
- `daq/{MachineId}/lowfreq`
- `daq/{MachineId}/detection/alerts`

### 模块变更

| 模块 | 操作 | 职责 |
|------|------|------|
| ConnectionPool | **新建** | 连接池核心：分组管理、创建/复用/销毁连接、常驻主题订阅、设备-连接映射 |
| deviceStore | 修改 | `isOnline` 改 `boolean\|null`；加 `caCert` 字段；加 persist 中间件 |
| mqtt/client.ts | 重构 | 去全局单例；暴露工厂函数按参数创建 MQTT 连接（含 TLS/CA） |
| useMqttConnect | 重写 | 协调连接池初始化 + 设备切换时主题变更 + Mock 模式协调 |
| router.ts | 改造 | 每条连接独立 onMessage 注册（连接池中配置） |
| ManualAddModal | 修改 | 加 CA 证书文件上传字段；去掉"临时连接测试"逻辑 |
| Sidebar/DeviceCard | 修改 | 三态显示（在线/离线/未知） |
| env.ts | 删除 | 废弃 4 个环境变量，仅保留 `VITE_MQTT_MODE` |

### 关键接口

**ConnectionPool 对外接口**:
```typescript
interface ConnectionPool {
  init(devices: Device[]): void;
  addDevice(device: Device): void;
  removeDevice(machineId: string): void;
  updateDevice(machineId: string, partial: Partial<Device>): void;
  getConnection(machineId: string): MqttClientLike | null;
  switchSelection(oldMachineId: string | null, newMachineId: string): void;
}
```

### Device 模型最终形态

```typescript
interface Device {
  id: string;               // MachineId（也是 MQTT clientId）
  name: string;             // 显示名称
  brokerUrl: string;        // Broker 地址（含协议）
  port: number;             // Broker 端口
  username: string;         // 认证用户名
  password: string;         // 认证密码
  tls: boolean;             // 是否启用 TLS
  caCert?: string;          // CA 证书 PEM 内容（用户上传 .crt 后读取）
  isOnline: boolean | null; // true=在线, false=离线, null=未知
}
```

### 连接生命周期

| 场景 | 行为 |
|------|------|
| 页面初始化 | 从 localStorage 恢复设备 → 分组 → 逐组建连 → 订阅常驻主题 |
| 手动添加设备 | 匹配已有连接 → 复用或新建 → 订阅该设备所有主题 |
| 删除设备 | 取消该设备所有订阅 → 若连接无设备则断开销毁 |
| 编辑设备 | key 不变仅更新 storage → key 变则换连接 |
| 连接失败 | 弹 error toast → 该连接设备 isOnline=null → 其他连接正常 |

### 数据结构

```
Map<connectionKey, MqttClient>   // 连接池
Map<machineId, connectionKey>    // 设备→连接逆向映射
```

---

## Testing Decisions

- **测试原则**: 只测试外部行为，通过公共接口验证
- **测试框架**: Vitest
- **被测模块**:
  - **ConnectionPool**: 分组复用、设备增删改、选中切换主题变更
  - **deviceStore（含 persist）**: isOnline 三态、localStorage 读写往返
  - **useMqttConnect**: 连接池与主题切换协调（集成测试，Mock 模式下验证）
- **不测试**: UI 组件（Sidebar、Modal）布局、router 配线代码

---

## Out of Scope

- 双向 TLS（clientCert/clientKey）
- 密码加密存储 — 当前明文 localStorage
- 自动发现改造 — HTTP API 砍掉后功能待后续独立 PRD
- EMQX HTTP API — 完全移除

---

## Further Notes

- PRD-001 被本 PRD 替代。PRD-001 中的"单连接 + 断连重连"方案已废弃。
- 连接池退化形态：大部分场景所有设备在同一 Broker 同一账号，连接池大小 = 1，行为极简。
- Mock 模式下 `MockMqttClient` 同样按连接池创建，验证连接池逻辑的一致性。
