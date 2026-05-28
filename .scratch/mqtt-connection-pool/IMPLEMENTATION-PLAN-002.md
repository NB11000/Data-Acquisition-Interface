# IMPLEMENTATION-PLAN-002: MQTT 连接池重构

**关联 PRD**: PRD-002
**日期**: 2026-05-29

---

## Modules

| 模块 | 类型 | 单一职责 |
|------|------|---------|
| `ConnectionPool` | 新建 | 连接池内核：按 key 分组管理 MQTT 连接生命周期、常驻主题订阅、设备-连接映射、选中设备主题切换 |
| `deviceStore` | 改造 | Device 模型扩展（isOnline 可空、caCert）、localStorage 持久化 |
| `mqtt/client` | 改造 | 去掉全局单例；暴露按连接参数创建 MQTT 连接的工厂（含 TLS/CA 支持） |
| `useMqttConnect` | 改造 | 编排连接池与设备切换：初始化连接池、选中切换时调用 ConnectionPool.switchSelection |
| `mqtt/router` | 改造 | 每条连接独立注册 onMessage（由 ConnectionPool 创建连接时配置） |
| `mqtt/rpc` | 不改造 | pendingRpcs 全局单例仍正确，无需改动 |
| `ManualAddModal` | 改造 | 加 CA 证书文件上传（读为 PEM string） |
| `Sidebar/DeviceCard` | 改造 | isOnline 三态 UI（true/false/null） |
| `env.ts` | 改造 | 废弃 4 个 env 变量 |
| `AutoDiscoverModal` | 不改造 | HTTP API 已砍，后续独立 PRD |

---

## Interfaces

### ConnectionPool ↔ deviceStore

```typescript
interface ConnectionPool {
  init(devices: Device[]): void;
  addDevice(device: Device): void;
  removeDevice(machineId: string): void;
  updateDevice(machineId: string, changes: Partial<Device>): void;
  getConnection(machineId: string): MqttClientLike | null;
  switchSelection(oldMachineId: string | null, newMachineId: string): void;
}
```

### ConnectionPool ↔ mqtt/client

```typescript
// 工厂函数，替代原 initMqttClient
function createMqttConnection(config: MqttConnectionConfig): MqttClientLike;

interface MqttConnectionConfig {
  clientId: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  caCert?: string;
}
```

### ConnectionPool ↔ mqtt/router

```typescript
// 每条连接创建后由 Pool 配置独立的 onMessage
function setupConnectionRouter(client: MqttClientLike): void;
// router.ts 中 setupMqttRouter 的函数体被复用，但不再使用全局 store 引用，
// 改为通过传入回调或由 Pool 持有引用
```

### deviceStore ↔ localStorage

```typescript
function loadDevices(): Device[];
function saveDevices(devices: Device[]): void;
// 内嵌到 deviceStore 的 persist middleware 中
```

---

## Data Flow

### 页面初始化

```
App 渲染 → useMqttConnect(url)
  → deviceStore.load()  // 从 localStorage 恢复设备
  → devices 按 connectionKey 分组
  → 每组: createMqttConnection(config) → setupConnectionRouter(client)
  → 每条连接: subscribeResidentTopics(client, deviceIds)
  → 每条连接: client.connect()
  → onConnect: $SYS 推送在线状态 → 更新 deviceStore.setOnline()
  → 默认选中第一个设备 → switchSelection(null, firstDevice.id)
  → subscribePerSelectionTopics(client, firstDevice.id)
```

### 设备切换

```
用户点击设备 B → deviceStore.setSelected('B')
  → useMqttConnect useEffect(selectedId)
  → connectionPool.switchSelection('A', 'B')
  → 旧连接上: unsubscribePerSelectionTopics(client, 'A')
  → 新连接上: subscribePerSelectionTopics(client, 'B')
  → 若 A 和 B 在同一连接: 无连接切换，仅主题变更
```

### 手动添加设备

```
用户填写表单 + 上传 .crt 文件 → handleSubmit
  → deviceStore.addDevice(device)
  → useMqttConnect useEffect(devices)
  → connectionPool.addDevice(device)
  → 若可复用: 复用连接 + subscribeResidentTopics(clientB, [device.id])
  → 若需新建: createMqttConnection → subscribeResidentTopics → connect
  → persistDevices()
```

### 连接失败

```
createMqttConnection → connect() → error
  → Pool 标记该连接为 failed
  → 该连接所有设备 isOnline = null
  → message.error("无法连接到 Broker xxx")
  → 其他连接不受影响
```

### RPC 调用

```
sendRpcCommand(machineId, method) → 不变
  → getConnection(machineId) → client
  → client.publish(...)
  → 响应通过各连接的 onMessage → tryResolveRpc 匹配 corrId
  → pendingRpcs 全局 Map 仍正确（corrId 是 GUID）
```

---

## Key Technical Decisions

| 决策 | 选择 | 为什么 | 拒绝的方案 |
|------|------|--------|-----------|
| 连接池 vs 单连接 | 连接池 | 不同 Broker 需不同连接；$SYS 实时监控依赖常驻连接 | 单连接：无法跨 Broker 监控；HTTP API 轮询：延迟大需额外配置 |
| isOnline 三态 | `boolean\|null` | 区分"设备离线"和"前端不知道" | 二态 boolean：连接故障时误报离线 |
| Mock 走连接池 | 是 | 保证 Mock/Real 代码路径一致，Mock 也能验证连接池逻辑 | Mock 单连接简化：测试覆盖不足 |
| pendingRpcs 不变 | 保持全局 Map | corrId 是 GUID，不存在跨连接冲突 | 按连接隔离：过度设计，无实际收益 |
| caCert 不进连接 key | 不进 | 同 Broker 的 CA 相同；第一个上传的设备提供 CA | 进 key：同 Broker 有两个 CA 不存在 |
| 废弃 global env | 仅保留 VITE_MQTT_MODE | 连接参数来源统一为 Device 模型 | 保留：两个真理来源导致混乱 |

---

## Test Strategy

| 模块 | 测试类型 | 验证重点 | 不测试 |
|------|---------|---------|--------|
| ConnectionPool | 单元测试（Vitest + MockMqttClient） | 分组分组正确性、device 增删改时订阅变化、switchSelection 主题切换正确、连接失败时 isOnline=null | MockMqttClient 内部实现 |
| deviceStore | 单元测试 | persist 往返（save→load 一致）、isOnline 三态 setter、devices 列表 CRUD | localStorage API（浏览器保证） |
| useMqttConnect | 集成测试（Mock 环境） | 初始化全流程：分组→建连→常驻订阅→选中→跟随订阅；设备切换流程 | Real MQTT 连接 |
| mqtt/client | 单元测试 | createMqttConnection 不同参数组合正确调 mqtt.connect | mqtt.js 库本身 |
| mqtt/router | 不单独测试 | — | — |
| UI 组件 | 不单独测试 | — | — |

---

## Vertical Slice Design

### Slice 1: Device 模型 + 持久化（基础依赖）
**依赖**: 无
**模块**: deviceStore
**内容**: isOnline 改 `boolean\|null`、加 caCert、加 persist middleware（load/save）
**测试**: deviceStore 单元测试
**可演示**: 手动改 localStorage 后刷新，设备列表恢复

### Slice 2: MQTT 连接工厂（底层依赖）
**依赖**: Slice 1
**模块**: mqtt/client
**内容**: 去单例、createMqttConnection(config)、Mock 模式适配
**测试**: client 单元测试
**可演示**: Mock 模式下按参数创建多条 MockMqttClient

### Slice 3: ConnectionPool 内核（核心深模块）
**依赖**: Slice 1, 2
**模块**: ConnectionPool（新建）
**内容**: 分组、建连、常驻订阅、设备映射、switchSelection、增删改设备时的连接管理
**测试**: ConnectionPool 单元测试
**可演示**: Mock 模式下创建 2 组连接、3 设备，切换选中，验证主题变化

### Slice 4: router 适配 + useMqttConnect 重写（配线层）
**依赖**: Slice 3
**模块**: mqtt/router, useMqttConnect
**内容**: router 改为每条连接独立注册；useMqttConnect 改为编排 ConnectionPool
**测试**: useMqttConnect 集成测试
**可演示**: 启动页面 → 侧边栏显示在线状态 → 切换设备波形变化

### Slice 5: UI 适配（表层）
**依赖**: Slice 4
**模块**: ManualAddModal, Sidebar/DeviceCard, env.ts
**内容**: caCert 文件上传、三态 UI、废弃无用 env 变量
**测试**: 无（手动验证）
**可演示**: 完整添加→切换→删除→编辑设备流程
