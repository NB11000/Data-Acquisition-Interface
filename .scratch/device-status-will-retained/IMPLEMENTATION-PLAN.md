# Implementation Plan: 设备在线状态 Will Retained 方案

> **日期**: 2026-06-03
> **父级**: PRD `device-status-will-retained`

## Modules

| 模块 | 文件 | 单一职责 |
|------|------|---------|
| **DeviceStatusPayload** | `src/mqtt/types.ts` | 定义 6 字段设备状态 Payload 类型 |
| **Topics 常量** | `src/mqtt/topics.ts` | 提供所有 MQTT 主题字符串工厂函数 |
| **ConnectionPool** | `src/mqtt/connectionPool.ts` | 管理多服务器 MQTT 连接池、通配符订阅、常驻/跟随主题订阅、在线客户端缓存 |
| **Router** | `src/mqtt/router.ts` | 消息路由分发：解析 topic → 匹配 handler → 调用对应 store 方法 |
| **Mock Generators** | `src/mock/useMockGenerators.ts` | Mock 模式下注入模拟设备上线 retained 消息 |
| **deviceStore** | `src/stores/deviceStore.ts` | 设备列表 CRUD、在线状态、选中设备 ID |
| **mqttStore** | `src/stores/mqttStore.ts` | MQTT 连接状态、崩溃 Banner 标记 |
| **Sidebar** | `src/components/Sidebar.tsx` | 侧边栏设备树：在线状态图标渲染 |
| **DeviceCard** | `src/components/DeviceCard.tsx` | 仪表盘设备卡片：在线状态徽标 |
| **Settings** | `src/pages/Settings/index.tsx` | 设置页设备表格：在线状态 Tag |
| **MqttStatusIndicator** | `src/components/MqttStatusIndicator.tsx` | 顶栏状态指示器：在线状态描述 |

## Interfaces

### Router ↔ deviceStore

Router 收到 `events/will` 消息后调用：

```typescript
// 新签名：增加 lastEventType 参数
deviceStore.setOnline(machineId: string, isOnline: boolean | null, lastEventType?: DeviceStatusPayload['eventType']): void
```

### Router ↔ mqttStore

仅崩溃时触发（不变）：

```typescript
mqttStore.setWill(deviceId: string): void
mqttStore.clearWill(): void
```

### Router ↔ ConnectionPool

在线客户端缓存更新（不变）：

```typescript
pool.addOnlineClient(serverId: string, clientId: string): void
pool.removeOnlineClient(serverId: string, clientId: string): void
pool.getOnlineClients(serverId: string): string[]
```

### ConnectionPool ↔ MQTT Client

连接成功时订阅（新）：

```typescript
client.subscribe('daq/+/events/will')  // 替代 subscribeSysTopics(client)
```

### Device → DeviceStore（持久化）

```typescript
interface Device {
  id: string;
  name: string;
  serverId: string;
  isOnline: boolean | null;
  lastEventType?: 'device_online' | 'device_offline' | 'process_crashed';
}
```

### DeviceStatusPayload（MQTT 消息契约）

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

## Data Flow

### 正常上线

```
设备 CONNACK → publish retained (status=online, eventType=device_online)
  → Broker → 前端通配符订阅匹配
  → router.onMessage:
      extractMachineId(topic) → "daq-srv-01"
      parse JSON → DeviceStatusPayload
      status === "online" → deviceStore.setOnline(id, true, "device_online")
      pool.addOnlineClient(serverId, id)
```

### 崩溃下线

```
Broker 检测 keepalive 超时 → 发布 Will retained (status=offline, eventType=process_crashed, ts=0)
  → Broker → 前端通配符订阅匹配
  → router.onMessage:
      extractMachineId(topic) → "daq-srv-01"
      parse JSON → DeviceStatusPayload
      status === "offline" && eventType === "process_crashed"
        → idempotency check: lastEventType already "process_crashed"? → skip
        → deviceStore.setOnline(id, false, "process_crashed")
        → mqttStore.setWill(id) → Banner 显示
        → pool.removeOnlineClient(serverId, id)
```

### 崩溃恢复

```
设备重启 → CONNECT → CONNACK → publish retained (status=online, eventType=device_online)
  → routed same as 正常上线
  → deviceStore.setOnline(id, true, "device_online")
  → mqttStore.clearWill() → Banner 消失
  → pool.addOnlineClient(serverId, id)
```

### 服务器断连

```
connectionPool.emitStateChange(serverId, 'disconnected')
  → 遍历该 serverId 下所有 Device
  → deviceStore.setOnline(id, null, undefined)  // lastEventType 置空
```

### 前端重连

```
connectionPool.create(server) → onConnect:
  1. client.subscribe("daq/+/events/will")
  2. 恢复 3 个设备级常驻主题（state_changed, device_alarm, RPC 响应）
  3. 恢复跟随主题（如果有选中设备）
  → Broker 推送所有 retained 消息 → router 逐条处理 → 全量状态恢复
```

## Key Technical Decisions

| 决策 | 选择 | 理由 |
|------|------|------|
| 订阅方式 | 通配符 `daq/+/events/will` | 一次订阅覆盖全部设备，消除时序问题，简化订阅管理 |
| Device 模型 | 新增 `lastEventType`，不改 `isOnline` 语义 | 最小改动，现有判断 isOnline 的逻辑无需修改 |
| 自动发现 | 保留 `getOnlineClients()` API | 只需改底层数据源，AddDeviceModal 一行不改 |
| 崩溃 Banner | 仅 `process_crashed` 触发 | 避免正常上下线骚扰用户 |
| 幂等策略 | ts 去重（正常）+ lastEventType 去重（崩溃） | 崩溃消息 ts=0 无法按时间比较 |
| 45s 窗口期 | 接受，不做补偿 | 侧边栏设备无数据流无法检测，定时器复杂度高收益低 |
| $SYS 移除 | 一次性删除 | 双轨并行会产生重复更新和冲突处理 |
| 主题命名 | 保持 `events/will` | 设备侧已按此名对接，改名成本高 |
| Mock | 仅模拟正常上线 | 崩溃是线上运维需求，mock 下无测试价值 |

## Test Strategy

### router.test.ts (修改)

| 测试场景 | 类型 | 验证点 |
|---------|------|--------|
| topic 匹配并提取 MachineId | 单元 | 合法 topic 提取正确 ID，非法 topic 返回空 |
| 上线消息处理 | 单元 | setOnline(id, true, "device_online") 被调用 |
| 正常下线消息处理 | 单元 | setOnline(id, false, "device_offline") 被调用 |
| 崩溃消息处理 | 单元 | setOnline(id, false, "process_crashed") + setWill(id) |
| 陌生 MachineId 丢弃 | 单元 | deviceStore 中无此 ID 时不调用 setOnline |
| ts 幂等（新 ts ≤ 旧） | 单元 | 跳过更新 |
| ts 幂等（新 ts > 旧） | 单元 | 执行更新 |
| 崩溃幂等（已崩溃） | 单元 | lastEventType 已为 process_crashed 时跳过 |
| 崩溃幂等（已恢复后再次崩溃） | 单元 | lastEventType 非 process_crashed 时执行更新 |
| 崩溃消息使用本地时间 | 单元 | ts=0 时忽略 payload 时间，使用 Date.now() |

### deviceStore.test.ts (新增)

| 测试场景 | 类型 | 验证点 |
|---------|------|--------|
| setOnline(true, "device_online") | 单元 | isOnline=true, lastEventType="device_online" |
| setOnline(false, "device_offline") | 单元 | isOnline=false, lastEventType="device_offline" |
| setOnline(false, "process_crashed") | 单元 | isOnline=false, lastEventType="process_crashed" |
| setOnline(null) 置空 | 单元 | isOnline=null, lastEventType=undefined |
| 不存在的设备 ID | 单元 | 设备列表不变 |

## Vertical Slice Design

### Slice 1: 类型定义 + 常量子初始化（无依赖）

**目标**: 建立 Payload 类型和通配符主题常量  
**模块**: `src/mqtt/types.ts`, `src/mqtt/topics.ts`  
**验证**: `pnpm build` 类型检查通过

### Slice 2: deviceStore 扩展（依赖 Slice 1）

**目标**: `setOnline` 支持 `lastEventType` 参数，实现双字段联动  
**模块**: `src/stores/deviceStore.ts`  
**测试**: `deviceStore.test.ts`（RED → GREEN → REFACTOR）  
**阻塞**: Slice 1

### Slice 3: Router 核心 handler（依赖 Slice 1, 2）

**目标**: 实现 events/will 消息解析、三态分发、幂等去重、Banner 触发  
**模块**: `src/mqtt/router.ts`  
**测试**: `router.test.ts`（10 个场景）  
**阻塞**: Slice 1, 2

### Slice 4: ConnectionPool 适配（依赖 Slice 1, 3）

**目标**: 移除 $SYS 订阅，改通配符 will 订阅；subscribeDevice 4→3；emitStateChange 增加 lastEventType 重置  
**模块**: `src/mqtt/connectionPool.ts`  
**阻塞**: Slice 1, 3

### Slice 5: Mock 生成器适配（依赖 Slice 1, 4）

**目标**: 从注入 $SYS 改为注入 retained online 消息  
**模块**: `src/mock/useMockGenerators.ts`  
**阻塞**: Slice 1, 4

### Slice 6: UI 组件适配（依赖 Slice 2）

**目标**: 4 个组件增加崩溃态红色显示 + DeviceCard 修复 null bug  
**模块**: Sidebar, DeviceCard, Settings, MqttStatusIndicator  
**阻塞**: Slice 2（不阻塞 Slice 3-5）
