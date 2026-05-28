# 数据采集与检测系统 V2.0 — 前端设计文档

## 概述

基于 React + TypeScript 构建数据采集与检测系统 V2.0 前端。第一轮以"数据中心"页面为核心，其余页面占位。通信采用 MQTT 单连接 + 强乐观 UI 更新模式。

## 技术栈

| 层级 | 选择 |
|------|------|
| 框架 | React 18 + TypeScript |
| 构建 | Vite + pnpm |
| UI 库 | Ant Design 5.x |
| MQTT | mqtt.js (MQTT 5.0 支持) |
| 状态管理 | Zustand |
| 图表 | uPlot (波形) + ECharts (Vis/Cn²/六要素) |
| 路由 | React Router v6 |
| CSS | ConfigProvider theme + CSS Modules + CSS 变量 |
| 后端 | 默认 Mock 模式，环境变量切换真实连接 |

## 范围边界

- **实现**：数据中心主页面（侧边栏设备管理、状态控制栏、2x2 图表区、自动发现/手动添加弹窗、遗嘱离线处理）
- **占位**：告警中心、历史数据、系统设置、日志查看（仅路由 + 空页面壳）

## 项目结构

```
src/
├── main.tsx
├── App.tsx
├── env.ts
├── assets/styles/
│   ├── variables.css
│   ├── global.css
│   └── antd-overrides.css
├── layouts/
│   └── AppLayout.tsx
├── pages/
│   ├── Dashboard/
│   │   ├── index.tsx
│   │   ├── StatusControlBar.tsx
│   │   ├── ChartGrid.tsx
│   │   └── components/
│   │       ├── WaveformChart.tsx
│   │       ├── VisChart.tsx
│   │       ├── Cn2Chart.tsx
│   │       └── SixParamPlaceholder.tsx
│   ├── Alerts/index.tsx
│   ├── History/index.tsx
│   ├── Settings/index.tsx
│   └── Logs/index.tsx
├── components/
│   ├── Navbar.tsx
│   ├── Sidebar.tsx
│   ├── DeviceCard.tsx
│   ├── Clock.tsx
│   ├── MqttStatusIndicator.tsx
│   └── modals/
│       ├── AutoDiscoverModal.tsx
│       └── ManualAddModal.tsx
├── mqtt/
│   ├── client.ts
│   ├── router.ts
│   ├── rpc.ts
│   ├── topics.ts
│   └── types.ts
├── stores/
│   ├── deviceStore.ts
│   ├── collectorStore.ts
│   ├── laserStore.ts
│   ├── waveformStore.ts
│   ├── dataStore.ts
│   ├── mqttStore.ts
│   └── alarmStore.ts
├── hooks/
│   ├── useMqttConnect.ts
│   ├── useRpcCommand.ts
│   ├── useResizeObserver.ts
│   └── useClock.ts
├── mock/
│   ├── mockMqttClient.ts
│   ├── mockWaveform.ts
│   ├── mockLowFreq.ts
│   └── mockRpc.ts
└── utils/
    ├── binary.ts
    ├── id.ts
    └── format.ts
```

## 组件树

```
AppLayout (100vh, flex column, 无外层滚动条)
├── Navbar (48px 固定)
│   ├── Logo + 标题
│   ├── Menu (Ant Tabs: 5 个页面 Tab)
│   └── 主题 Switch + 用户头像
├── Content (flex: 1, flex row, overflow: hidden)
│   ├── Sidebar (250px)
│   │   ├── 设备统计 + 搜索框
│   │   ├── 设备列表 (scroll, flex: 1)
│   │   │   └── DeviceCard[]
│   │   └── 底部固定 [自动发现] [手动添加]
│   └── ContentArea (flex: 1, flex column, padding)
│       ├── StatusControlBar
│       │   ├── Row1: 设备名 | 状态灯 ×3 | 时钟
│       │   ├── Row2: [采集控制组] [激光控制组]
│       │   └── Banner (遗嘱时滑出)
│       └── ChartGrid (flex: 1, 2×2)
│           ├── WaveformChart (uPlot)
│           ├── VisChart (ECharts)
│           ├── SixParamPlaceholder (Empty)
│           └── Cn2Chart (ECharts)
└── Modals
    ├── AutoDiscoverModal
    └── ManualAddModal
```

## MQTT 数据流架构

### 连接模型

单 MQTT 连接 + 中央路由 + 通配符订阅。一次只展示一个选中设备的数据。

```
MQTT Broker
  → mqtt/client.ts (单例)
  → mqtt/router.ts (按 topic 正则分发)
  → Zustand stores (按照 topic 类型写入对应 store)
```

### 主题订阅

| Topic Pattern | QoS | Handler |
|---------------|-----|---------|
| `daq/{id}/waveform/ch1` | 0 | `waveformStore.appendCh1(binary)` |
| `daq/{id}/waveform/ch2` | 0 | `waveformStore.appendCh2(binary)` |
| `daq/{id}/events/state_changed` | 1 | `collectorStore.apply()` + `laserStore.apply()` |
| `daq/{id}/events/will` | 1 | `mqttStore.setWill()` → Banner + 全局置灰 |
| `daq/{id}/events/device_alarm` | 1 | `alarmStore.add()` |
| `daq/{id}/lowfreq` | 1 | `dataStore.append()` |
| `$rpc/{id}/+/+/response` | 1 | `rpc.resolve(corrId)` |

### 设备切换流程

```
点击 DeviceCard → deviceStore.setSelected(id)
  → 取消订阅旧设备所有主题
  → 订阅新设备波形 + 事件 + 低频主题
  → 发送 SYSTEM_STATE RPC → applyStateToUI
  → UI 切换完成
```

### RPC 请求流程

```
sendRpcCommand(method)
  → 按钮过渡态 "发送中..."
  → publish $rpc/{id}/{method}/{corrId} (QoS 1)
  → 等待响应 topic (10s 超时)
    ├── success → 乐观更新按钮 "运行中"
    ├── fail    → 恢复 idle + message.error
    └── timeout → 恢复 idle + message.error('无响应')
  → 后续 state_changed 被动纠偏
```

## Zustand Store 设计

### deviceStore

```typescript
interface Device {
  id: string; name: string;
  brokerUrl: string; port: number;
  username: string; password: string;
  tls: boolean;
  isOnline: boolean;
}
interface DeviceStore {
  devices: Device[];
  selectedId: string | null;
  searchText: string;
  addDevice(d: Device): void;
  removeDevice(id: string): void;
  setSelected(id: string): void;
  setOnline(id: string, online: boolean): void;
  setSearch(text: string): void;
}
```

### collectorStore / laserStore

```typescript
type ButtonPhase = 'idle' | 'sending' | 'running' | 'error';

interface CollectorStore {
  processConnected: boolean;
  deviceOpened: boolean;
  acquiring: boolean;
  openButtonPhase: ButtonPhase;
  startButtonPhase: ButtonPhase;
  applyState(s: CollectorStateDto): void;
  setButtonPhase(btn, phase): void;
}

interface LaserStore {
  serialConnected: boolean;
  emissionOn: boolean;
  portName: string | null;
  connectButtonPhase: ButtonPhase;
  laserButtonPhase: ButtonPhase;
  applyState(s: LaserStateDto): void;
  setButtonPhase(btn, phase): void;
}
```

**按钮禁用规则**（前端本地 `computeButtonDisabled` 计算，不依赖后端 uiHints）：

| 条件 | openCollector | startAcquisition | connectLaser | laserOn |
|------|:---:|:---:|:---:|:---:|
| 设备未连接 | X | X | X | X |
| 采集卡已打开 | X | - | - | - |
| 采集进行中 | - | X | - | - |
| 激光已连接 | - | - | X | - |
| 激光已发射 | - | - | - | X |

### waveformStore

```typescript
interface WaveformFrame {
  timestamp: number;
  data: Float64Array; // 1000 points
}
interface WaveformStore {
  ch1: WaveformFrame[]; // 环形缓冲，最多 200 帧
  ch2: WaveformFrame[];
  appendCh1(buf: ArrayBuffer): void;
  appendCh2(buf: ArrayBuffer): void;
  clear(): void;
}
```

二进制解析：小端序 `double[1000]`，8000 字节，通过 `DataView.getFloat64(_, true)` 读取。

### dataStore

```typescript
interface LowFreqSample {
  timestamp: number;
  ch1: number; ch2: number;
  vis: number; cn2: number;
  temp: number; humi: number;
  press: number; windSpd: number;
  rain: number; windDir: number;
}
// 最近 500 条，7s 追加一条
```

### mqttStore / alarmStore

```typescript
interface MqttStore {
  mqttConnected: boolean;
  willReceived: boolean;
  willDeviceId: string | null;
}

interface AlarmStore {
  alarms: DeviceAlarm[];
  unreadCount: number;
}
```

## 主题系统

### CSS 变量

`:root` 和 `body.dark-theme` 各一套。自定义组件通过 `var(--xxx)` 读取：

- `--app-bg-color`、`--app-sidebar-bg`、`--statusbar-bg`
- `--text-primary`、`--text-secondary`
- `--chart-card-bg`、`--chart-card-border-top`

### Ant Design 主题

ConfigProvider `theme.algorithm` 根据 `body.dark-theme` 切换 `defaultAlgorithm` / `darkAlgorithm`。

## 图表方案

| 图表 | 库 | 刷新率 | 数据源 |
|------|-----|--------|--------|
| 双通道电压波形 | uPlot | 100ms (QoS 0) | `waveformStore` ch1/ch2 |
| Vis 能见度 | ECharts | 7s (QoS 1) | `dataStore.samples[].vis` |
| Cn² 折射率 | ECharts | 7s (QoS 1) | `dataStore.samples[].cn2` |
| 六要素 | Empty 占位 | — | 后端暂不可用 |

uPlot 通过 `ResizeObserver` 自适应容器尺寸，ECharts 使用 `echarts.init().resize()`。

## 路由

```typescript
<Routes>
  <Route path="/" element={<AppLayout />}>
    <Route index element={<Navigate to="/dashboard" />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="alerts" element={<Alerts />} />
    <Route path="history" element={<History />} />
    <Route path="settings" element={<Settings />} />
    <Route path="logs" element={<Logs />} />
  </Route>
</Routes>
```

## Mock 策略

环境变量 `VITE_MQTT_MODE=mock|real`：mock 模式下由 `mock/mockMqttClient.ts` 模拟 connect/subscribe/publish，`mockWaveform.ts` 生成正弦波 + 噪声的双通道 1000 点数据（100ms 间隔），`mockLowFreq.ts` 生成 7s 间隔的低频 12 字段数据，`mockRpc.ts` 模拟 200-500ms 延迟的 RPC 响应（默认成功）。

## 错误处理

| 场景 | UI 响应 |
|------|---------|
| MQTT 断连 | 顶部红色 Banner + 所有按钮 disabled |
| 遗嘱触发 | 全宽红色 Banner + 按钮 disabled + 图表冻结 |
| RPC 超时 (10s) | 按钮回退 + `message.error` |
| RPC fail | 按钮回退 + `message.error(result.message)` |
| 波形解析失败 | 静默丢弃，DevTools 可见计数 |
| 图表异常 | 单卡片 Empty/Retry，不崩溃全局 |

---

*文档版本：1.0 | 2026-05-27*
