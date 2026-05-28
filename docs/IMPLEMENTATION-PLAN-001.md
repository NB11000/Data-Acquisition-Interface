# Implementation Plan — 设备 MQTT 配置重构

**基于**: [PRD-001](PRD-001-设备Mqtt配置重构.md)
**日期**: 2026-05-28

---

## Modules

| 模块 | 职责 | 操作 |
|------|------|------|
| `utils/devicePersistence` | localStorage 存取 Device[]，序列化/反序列化 | **新建** |
| `stores/deviceStore` | Device 模型 + CRUD + isOnline + 持久化集成 | **修改** |
| `mqtt/client` | MQTT 连接管理：按 Device 配置创建连接、断开、重连 | **修改** |
| `hooks/useMqttConnect` | 设备选中 → brokerUrl 对比 → 订阅切换或重连 → 编辑后提示 | **修改** |
| `components/modals/ManualAddModal` | 手动添加表单：CA 证书上传、完整连接字段 | **修改** |
| `components/modals/AutoDiscoverModal` | 自动发现：先填 Broker 配置 → 扫描 → 继承给设备 | **修改** |
| `components/ReconnectPrompt` | 右下角浮层："设备连接参数已变更，是否重连？" | **新建** |
| `env.ts` / `.env` | 删除全局 Broker 变量，保留 MODE + DEFAULT_MACHINE_ID | **修改** |

---

## Interfaces

### devicePersistence ↔ deviceStore

```
saveDevices(devices: Device[]): void
loadDevices(): Device[]
removeDevices(): void
```

### deviceStore → 外部

```
addDevice(d: Omit<Device, 'isOnline'>): void
removeDevice(id: string): void
updateDevice(id: string, partial: Partial<Device>): void
setOnline(id: string, online: boolean): void
setSelected(id: string): void
setSearch(text: string): void

// 新增
hydrateFromStorage(): void
hasConnectionChanged(id: string, prev: Device, next: Partial<Device>): boolean
```

### mqttClient

```
initMqttClient(device: Device): MqttClientLike
destroyCurrentClient(): void
getCurrentClient(): MqttClientLike | null
getCurrentBrokerUrl(): string | null
```

### useMqttConnect (内部 behavior)

```
选中 Device 变化:
  currentBrokerUrl === device.brokerUrl → 仅切换 topic 订阅
  currentBrokerUrl !== device.brokerUrl (或无连接) → 断开旧连接 → 创建新连接 → 订阅

编辑保存后:
  若 device.id === selectedId && 连接参数变更 && 变更不只 name
    → 显示 ReconnectPrompt
```

### ReconnectPrompt

```
Props:
  visible: boolean
  message: string
  onConfirm: () => void    // 断开重连
  onDismiss: () => void    // 忽略，继续用旧连接
```

---

## Data Flow

### 添加设备流程

```
用户打开 ManualAddModal
  → 填写: name, machineId, brokerUrl, port, username, password
  → 选择 tls 开关
  → [可选] 上传 CA 证书 .crt 文件 → FileReader 读为 PEM 字符串
  → 点击保存
  → deviceStore.addDevice({...完整配置, isOnline: false})
  → devicePersistence.saveDevices(deviceStore.devices)
```

### 选中设备流程

```
用户点击 DeviceCard
  → deviceStore.setSelected(device.id)
  → useMqttConnect 检测 selectedId 变化
    → 若 brokerUrl 未变: unsubscribe 旧 device → subscribe 新 device 的 7 个 topic
    → 若 brokerUrl 变了: destroyCurrentClient → initMqttClient(device) → 订阅
    → 发送 SYSTEM_STATE RPC
```

### 编辑保存 + 提示重连流程

```
用户编辑 Device (且当前被选中, 且改了连接参数)
  → deviceStore.updateDevice(id, partial)
  → devicePersistence.saveDevices(devices)
  → useMqttConnect 检测: selectedId === editedId && hasConnectionChanged()
  → 显示 ReconnectPrompt
    → 用户点确认: destroyCurrentClient → initMqttClient(updatedDevice) → 重新订阅
    → 用户点忽略: 维持当前连接，下次切走再切回时自动用新配置
```

---

## Key Technical Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 每设备独立 MQTT 配置 vs 全局配置 | 每设备独立 | 支持多 Broker 场景，领域模型正确 (ADR-0001) |
| 连接数 | 1 个活跃 | UI 只展示一设备数据，节省资源 |
| 同 Broker 切换 | 只切 topic | 避免不必要的 TLS 握手延迟 |
| 编辑后重连 | 用户确认而非自动 | 用户可能在观察当前数据，保留控制权 |
| CA 证书输入方式 | 上传 .crt 文件 | 防 PEM 文本格式错误，安全性等价 |
| 持久化方式 | localStorage | 无后端存储，最简方案 |
| 密码存储 | 明文 | 已知风险，加密方案独立 PRD |
| Mock 模式下连接配置 | 仍需完整填写 | Real 模式切换时零摩擦 |

---

## Test Strategy

| 模块 | 测试类型 | 测试点 |
|------|---------|--------|
| `devicePersistence` | Unit (Vitest) | save / load 往返正确性；空数组；特殊字符 id |
| `deviceStore` | Unit (Vitest) | addDevice / removeDevice / updateDevice / setOnline 状态变更正确性；hydrate 后设备列表一致 |
| `mqttClient` | Unit (mock mqtt.js) | init / destroy 生命周期；ca 证书传入正确；同一 brokerUrl 复用判断 |
| `useMqttConnect` | Integration (React Testing Library) | 同 brokerUrl 仅切订阅；不同 brokerUrl 断开重连；编辑后触发提示 |
| Modal 组件 | 手动测试 | 表单交互、上传文件 UI 不写单元测试 |
| `ReconnectPrompt` | Unit | visible/onConfirm/onDismiss 回调正确性 |

---

## Vertical Slice Design

### Slice 1: Device 模型 + 持久化
**依赖**: 无
**模块**: `devicePersistence` (新), `deviceStore` (改)
**产出**: Device 模型含 10 字段，localStorage 持久化生效，刷新页面设备列表恢复

### Slice 2: MQTT 客户端改造
**依赖**: Slice 1
**模块**: `mqtt/client` (改), `env.ts` + `.env` (改)
**产出**: `initMqttClient` 接收完整 Device 配置，支持 ca/cert 参数，支持 `destroyCurrentClient`

### Slice 3: 切换逻辑 + 重连提示
**依赖**: Slice 2
**模块**: `hooks/useMqttConnect` (改), `components/ReconnectPrompt` (新)
**产出**: brokerUrl 对比逻辑生效；编辑已选设备后弹出重连提示

### Slice 4: 添加/编辑弹窗改造
**依赖**: Slice 1
**模块**: `ManualAddModal` (改), `AutoDiscoverModal` (改)
**产出**: CA 证书上传、完整连接字段、自动发现继承配置

### Slice 5: 端到端验证
**依赖**: Slice 1–4
**产出**: Mock 模式 + Real 模式全流程验证通过
