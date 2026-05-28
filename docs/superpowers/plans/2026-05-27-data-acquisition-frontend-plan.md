# 数据采集与检测系统 V2.0 前端 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建数据中心主页面（设备管理、状态控制栏、2x2 图表区、弹窗），其余 4 个页面占位。

**Architecture:** 单 MQTT 连接 + 中央消息路由分发至 Zustand stores，React 组件通过 hooks 订阅 stores。Mock 层在本地模拟全部 MQTT 通信。强乐观 UI 更新：RPC 成功即更新 UI，后续 state_changed 被动纠偏。

**Tech Stack:** React 18 + TypeScript + Vite + Ant Design 5.x + mqtt.js + Zustand + uPlot + ECharts + React Router v6

---

### Task 1: 脚手架初始化

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `pnpm-lock.yaml`

- [ ] **Step 1: 创建 package.json**

```bash
cd "e:/新建文件夹 (2)/前端页面"
pnpm init
```

- [ ] **Step 2: 安装依赖**

```bash
pnpm add react react-dom react-router-dom antd @ant-design/icons mqtt zustand uplot echarts echarts-for-react
pnpm add -D typescript @types/react @types/react-dom @types/node vite @vitejs/plugin-react
```

- [ ] **Step 3: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': '/src' },
  },
});
```

- [ ] **Step 6: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>数据采集与检测系统 V2.0</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 验证脚手架**

```bash
pnpm install
pnpm dev
```

预期：Vite dev server 启动成功（暂无 src/main.tsx 会报错，下一步修复）。

---

### Task 2: 工具函数

**Files:**
- Create: `src/utils/id.ts`, `src/utils/format.ts`, `src/utils/binary.ts`

- [ ] **Step 1: 创建 `src/utils/id.ts`**

```typescript
export function generateGuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 2: 创建 `src/utils/format.ts`**

```typescript
export function formatTimestamp(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

export function formatVis(vis: number): string {
  return `${vis.toFixed(2)} km`;
}

export function formatCn2(cn2: number): string {
  if (cn2 === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(cn2)));
  const mantissa = cn2 / Math.pow(10, exp);
  return `${mantissa.toFixed(2)}e${exp}`;
}

export function formatVoltage(v: number): string {
  return `${v.toFixed(4)} V`;
}
```

- [ ] **Step 3: 创建 `src/utils/binary.ts`**

```typescript
export function parseWaveformBinary(buffer: ArrayBuffer): Float64Array {
  if (buffer.byteLength !== 8000) {
    console.warn(`[binary] Expected 8000 bytes, got ${buffer.byteLength}`);
    return new Float64Array(1000);
  }
  const data = new Float64Array(1000);
  const view = new DataView(buffer);
  for (let i = 0; i < 1000; i++) {
    data[i] = view.getFloat64(i * 8, true); // little-endian
  }
  return data;
}
```

- [ ] **Step 4: 提交**

```bash
git add src/utils/
git commit -m "feat: add utils (id, format, binary)"
```

---

### Task 3: CSS 变量、全局样式、主题基础

**Files:**
- Create: `src/assets/styles/variables.css`, `src/assets/styles/global.css`, `src/assets/styles/antd-overrides.css`

- [ ] **Step 1: 创建 `src/assets/styles/variables.css`**

```css
:root {
  --app-bg-color: #f0f2f5;
  --app-content-bg: #ffffff;
  --app-sidebar-bg: #ffffff;
  --app-navbar-bg: #001529;
  --text-primary: rgba(0, 0, 0, 0.85);
  --text-secondary: rgba(0, 0, 0, 0.45);
  --statusbar-bg: #fafafa;
  --statusbar-border: #e8e8e8;
  --chart-card-bg: #ffffff;
  --chart-card-border-top: #1890ff;
  --chart-card-padding: 8px;
  --device-card-hover: #e6f7ff;
  --navbar-text: rgba(255, 255, 255, 0.85);
}

body.dark-theme {
  --app-bg-color: #141414;
  --app-content-bg: #1f1f1f;
  --app-sidebar-bg: #1f1f1f;
  --app-navbar-bg: #141414;
  --text-primary: rgba(255, 255, 255, 0.85);
  --text-secondary: rgba(255, 255, 255, 0.45);
  --statusbar-bg: rgba(255, 255, 255, 0.04);
  --statusbar-border: #303030;
  --chart-card-bg: #1f1f1f;
  --chart-card-border-top: #1890ff;
  --chart-card-padding: 8px;
  --device-card-hover: #111d2c;
  --navbar-text: rgba(255, 255, 255, 0.85);
}
```

- [ ] **Step 2: 创建 `src/assets/styles/global.css`**

```css
@import './variables.css';

*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

body {
  background-color: var(--app-bg-color);
  color: var(--text-primary);
  transition: background-color 0.2s, color 0.2s;
}
```

- [ ] **Step 3: 创建 `src/assets/styles/antd-overrides.css`**

```css
/* 保留原 MainPage.css 的图表卡片顶部色条 */
.chart-card-header {
  border-top: 3px solid var(--chart-card-border-top);
}
```

- [ ] **Step 4: 提交**

```bash
git add src/assets/styles/
git commit -m "feat: add CSS variables, global styles, theme foundation"
```

---

### Task 4: MQTT 类型定义与主题模板

**Files:**
- Create: `src/mqtt/types.ts`, `src/mqtt/topics.ts`

- [ ] **Step 1: 创建 `src/mqtt/types.ts`**

```typescript
// ── RPC ──
export interface CommandResult {
  success: boolean;
  code: string;
  message: string;
  state?: SystemStateDto;
  timestamp: string;
}

// ── SystemState ──
export interface SystemStateDto {
  server: { isApiAlive: boolean; timestamp: string };
  collector: CollectorStateDto;
  laser: LaserStateDto;
  uiHints?: UiHintsDto;
  timestamp: string;
}

export interface CollectorStateDto {
  processConnected: boolean;
  deviceOpened: boolean;
  acquiring: boolean;
  handle?: number;
  lastMessage?: string;
  timestamp?: string;
}

export interface LaserStateDto {
  serialConnected: boolean;
  emissionOn: boolean;
  portName?: string;
  lastMessage?: string;
  timestamp?: string;
}

export interface UiHintsDto {
  canOpenCollector: boolean;
  canCloseCollector: boolean;
  canStartAcquisition: boolean;
  canStopAcquisition: boolean;
  canConnectLaser: boolean;
  canDisconnectLaser: boolean;
  canTurnLaserOn: boolean;
  canTurnLaserOff: boolean;
}

// ── Events ──
export interface StateChangedEvent {
  eventType: string;
  source: 'collector' | 'laser' | 'system' | 'mqtt_broker';
  reason: string;
  message: string;
  state: SystemStateDto;
  timestamp: string;
}

export interface WillMessage {
  eventType: 'process_crashed';
  source: 'mqtt_broker';
  reason: 'will_message';
  message: string;
}

export interface DeviceAlarm {
  alarmType: string;
  device: string;
  message: string;
  severity: number;
  timestamp: string;
}

// ── LowFreq ──
export interface LowFreqSample {
  timestamp: number;
  utc: string;
  ch1: number;
  ch2: number;
  vis: number;
  cn2: number;
  temp: number;
  humi: number;
  press: number;
  windSpd: number;
  rain: number;
  windDir: number;
}

// ── Device ──
export interface DeviceInfo {
  id: string;
  name: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}
```

- [ ] **Step 2: 创建 `src/mqtt/topics.ts`**

```typescript
export function waveformCh1Topic(machineId: string): string {
  return `daq/${machineId}/waveform/ch1`;
}

export function waveformCh2Topic(machineId: string): string {
  return `daq/${machineId}/waveform/ch2`;
}

export function stateChangedTopic(machineId: string): string {
  return `daq/${machineId}/events/state_changed`;
}

export function willTopic(machineId: string): string {
  return `daq/${machineId}/events/will`;
}

export function deviceAlarmTopic(machineId: string): string {
  return `daq/${machineId}/events/device_alarm`;
}

export function lowFreqTopic(machineId: string): string {
  return `daq/${machineId}/lowfreq`;
}

export function rpcRequestTopic(machineId: string, method: string, corrId: string): string {
  return `$rpc/${machineId}/${method}/${corrId}`;
}

export function rpcResponsePattern(machineId: string): string {
  return `$rpc/${machineId}/+/+/response`;
}

export function allDeviceEventsPattern(machineId: string): string {
  return `daq/${machineId}/events/#`;
}

export function allDeviceWaveformPattern(machineId: string): string {
  return `daq/${machineId}/waveform/#`;
}
```

- [ ] **Step 3: 提交**

```bash
git add src/mqtt/types.ts src/mqtt/topics.ts
git commit -m "feat: add MQTT types and topic templates"
```

---

### Task 5: 环境变量配置

**Files:**
- Create: `src/env.ts`, `.env`

- [ ] **Step 1: 创建 `.env`**

```env
VITE_MQTT_MODE=mock
VITE_BROKER_URL=mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883
VITE_BROKER_USERNAME=001
VITE_BROKER_PASSWORD=001
VITE_DEFAULT_MACHINE_ID=daq-srv-01
```

- [ ] **Step 2: 创建 `src/env.ts`**

```typescript
export const MQTT_MODE = import.meta.env.VITE_MQTT_MODE as 'mock' | 'real';
export const BROKER_URL = import.meta.env.VITE_BROKER_URL as string;
export const BROKER_USERNAME = import.meta.env.VITE_BROKER_USERNAME as string;
export const BROKER_PASSWORD = import.meta.env.VITE_BROKER_PASSWORD as string;
export const DEFAULT_MACHINE_ID = import.meta.env.VITE_DEFAULT_MACHINE_ID as string;
```

- [ ] **Step 3: 提交**

```bash
git add src/env.ts .env
git commit -m "feat: add environment config"
```

---

### Task 6: Mock 层 — MQTT 模拟客户端

**Files:**
- Create: `src/mock/mockMqttClient.ts`

- [ ] **Step 1: 创建 `src/mock/mockMqttClient.ts`**

```typescript
type MessageHandler = (topic: string, payload: Buffer | Uint8Array) => void;

interface MockSubscription {
  topic: string;
  handler: MessageHandler;
}

type EventHandler = (topic: string, payload: Uint8Array) => void;

export class MockMqttClient {
  private subscriptions: MockSubscription[] = [];
  private connected = false;
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  connect(): void {
    setTimeout(() => {
      this.connected = true;
      console.log(`[MockMqtt] ${this.clientId} connected`);
      if (this.onConnect) this.onConnect();
    }, 100);
  }

  subscribe(topic: string): void {
    this.subscriptions.push({ topic, handler: () => {} });
    console.log(`[MockMqtt] ${this.clientId} subscribed: ${topic}`);
  }

  unsubscribe(topic: string): void {
    this.subscriptions = this.subscriptions.filter((s) => s.topic !== topic);
    console.log(`[MockMqtt] ${this.clientId} unsubscribed: ${topic}`);
  }

  publish(topic: string, payload: string | Uint8Array): void {
    console.log(`[MockMqtt] ${this.clientId} publish → ${topic}`);
  }

  /** 模拟消息到达（供 mock 层注入数据） */
  injectMessage(topic: string, payload: Uint8Array): void {
    if (!this.connected) return;
    // 匹配通配符订阅
    for (const sub of this.subscriptions) {
      if (this.topicMatches(sub.topic, topic) && this.onMessage) {
        this.onMessage(topic, payload);
        break;
      }
    }
  }

  /** 模拟断连 */
  injectDisconnect(): void {
    this.connected = false;
    if (this.onDisconnect) this.onDisconnect();
  }

  /** 模拟重连 */
  injectReconnect(): void {
    this.connected = true;
    if (this.onConnect) this.onConnect();
  }

  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onMessage: MessageHandler | null = null;

  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (i >= topicParts.length) return false;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return patternParts.length === topicParts.length;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add src/mock/mockMqttClient.ts
git commit -m "feat: add mock MQTT client"
```

---

### Task 7: Mock 层 — 模拟数据生成器

**Files:**
- Create: `src/mock/mockWaveform.ts`, `src/mock/mockLowFreq.ts`

- [ ] **Step 1: 创建 `src/mock/mockWaveform.ts`**

```typescript
import type { MockMqttClient } from './mockMqttClient';

export function startMockWaveform(
  mockClient: MockMqttClient,
  machineId: string,
  intervalMs = 100,
): () => void {
  let running = true;
  let t = 0;

  const timer = setInterval(() => {
    if (!running) return;

    const ch1 = generateFrame(t, 1.0, 50, 0.05);
    const ch2 = generateFrame(t, 0.8, 30, 0.07);

    mockClient.injectMessage(`daq/${machineId}/waveform/ch1`, ch1);
    mockClient.injectMessage(`daq/${machineId}/waveform/ch2`, ch2);
    t++;
  }, intervalMs);

  return () => {
    running = false;
    clearInterval(timer);
  };
}

function generateFrame(
  baseIndex: number,
  amplitude: number,
  frequency: number,
  noise: number,
): Uint8Array {
  const buffer = new ArrayBuffer(8000);
  const view = new DataView(buffer);
  for (let i = 0; i < 1000; i++) {
    const t = (baseIndex * 1000 + i) / 1000;
    const value =
      amplitude * Math.sin(2 * Math.PI * frequency * t) +
      (Math.random() - 0.5) * noise;
    view.setFloat64(i * 8, value, true);
  }
  return new Uint8Array(buffer);
}
```

- [ ] **Step 2: 创建 `src/mock/mockLowFreq.ts`**

```typescript
import type { LowFreqSample } from '../mqtt/types';
import type { MockMqttClient } from './mockMqttClient';

export function startMockLowFreq(
  mockClient: MockMqttClient,
  machineId: string,
  intervalMs = 7000,
): () => void {
  let running = true;
  let index = 0;

  const timer = setInterval(() => {
    if (!running) return;

    const sample: LowFreqSample = {
      timestamp: index++,
      utc: new Date().toISOString(),
      ch1: 1.0 + (Math.random() - 0.5) * 0.2,
      ch2: 0.8 + (Math.random() - 0.5) * 0.15,
      vis: 12.0 + (Math.random() - 0.5) * 2,
      cn2: 8.9e-13 + (Math.random() - 0.5) * 1e-13,
      temp: 22.5 + (Math.random() - 0.5) * 2,
      humi: 60 + (Math.random() - 0.5) * 10,
      press: 1013.25 + (Math.random() - 0.5) * 5,
      windSpd: 2.5 + (Math.random() - 0.5) * 1,
      rain: Math.random() > 0.9 ? Math.random() * 2 : 0,
      windDir: Math.random() * 360,
    };

    const json = JSON.stringify(sample);
    mockClient.injectMessage(
      `daq/${machineId}/lowfreq`,
      new TextEncoder().encode(json),
    );
  }, intervalMs);

  return () => {
    running = false;
    clearInterval(timer);
  };
}
```

- [ ] **Step 3: 提交**

```bash
git add src/mock/mockWaveform.ts src/mock/mockLowFreq.ts
git commit -m "feat: add mock data generators (waveform + lowfreq)"
```

---

### Task 8: Mock 层 — RPC 模拟器

**Files:**
- Create: `src/mock/mockRpc.ts`

- [ ] **Step 1: 创建 `src/mock/mockRpc.ts`**

```typescript
import type { CommandResult, SystemStateDto } from '../mqtt/types';
import type { MockMqttClient } from './mockMqttClient';

const defaultState: SystemStateDto = {
  server: { isApiAlive: true, timestamp: new Date().toISOString() },
  collector: {
    processConnected: true,
    deviceOpened: false,
    acquiring: false,
    lastMessage: '',
  },
  laser: {
    serialConnected: false,
    emissionOn: false,
    portName: 'COM3',
    lastMessage: '',
  },
  timestamp: new Date().toISOString(),
};

let currentState: SystemStateDto = { ...defaultState };

export function getMockState(): SystemStateDto {
  return { ...currentState, timestamp: new Date().toISOString() };
}

export function handleMockRpc(
  mockClient: MockMqttClient,
  machineId: string,
  method: string,
  corrId: string,
): void {
  const responseTopic = `$rpc/${machineId}/${method}/${corrId}/response`;
  const delay = 200 + Math.random() * 300; // 200-500ms

  setTimeout(() => {
    let result: CommandResult;

    switch (method) {
      case 'SYSTEM_STATE':
        result = {
          success: true,
          code: 'OK',
          message: '系统状态获取成功',
          state: getMockState(),
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-open-device':
        currentState.collector.deviceOpened = true;
        result = {
          success: true,
          code: 'COLLECTOR_OPENED',
          message: '采集卡已打开',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-close-device':
        currentState.collector.deviceOpened = false;
        currentState.collector.acquiring = false;
        result = {
          success: true,
          code: 'COLLECTOR_CLOSED',
          message: '采集卡已关闭',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-start-ad':
        currentState.collector.acquiring = true;
        result = {
          success: true,
          code: 'AD_STARTED',
          message: '采集已开始',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-stop-ad':
        currentState.collector.acquiring = false;
        result = {
          success: true,
          code: 'AD_STOPPED',
          message: '采集已停止',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-connect':
        currentState.laser.serialConnected = true;
        result = {
          success: true,
          code: 'LASER_CONNECTED',
          message: '激光器已连接',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-disconnect':
        currentState.laser.serialConnected = false;
        currentState.laser.emissionOn = false;
        result = {
          success: true,
          code: 'LASER_DISCONNECTED',
          message: '激光器已断开',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-on':
        currentState.laser.emissionOn = true;
        result = {
          success: true,
          code: 'LASER_ON',
          message: '激光已开启',
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-off':
        currentState.laser.emissionOn = false;
        result = {
          success: true,
          code: 'LASER_OFF',
          message: '激光已关闭',
          timestamp: new Date().toISOString(),
        };
        break;

      default:
        result = {
          success: false,
          code: 'UNKNOWN_METHOD',
          message: `未知方法: ${method}`,
          timestamp: new Date().toISOString(),
        };
    }

    const payload = new TextEncoder().encode(JSON.stringify(result));
    mockClient.injectMessage(responseTopic, payload);
  }, delay);
}
```

- [ ] **Step 2: 提交**

```bash
git add src/mock/mockRpc.ts
git commit -m "feat: add mock RPC handler"
```

---

### Task 9: MQTT 真实客户端 + 路由 + RPC 管理器

**Files:**
- Create: `src/mqtt/client.ts`, `src/mqtt/router.ts`, `src/mqtt/rpc.ts`

- [ ] **Step 1: 创建 `src/mqtt/client.ts`**

```typescript
import mqtt, { type MqttClient } from 'mqtt';
import { MockMqttClient } from '../mock/mockMqttClient';
import { MQTT_MODE, BROKER_URL, BROKER_USERNAME, BROKER_PASSWORD } from '../env';

export type MqttClientLike = MqttClient | MockMqttClient;

let client: MqttClientLike | null = null;

export function getMqttClient(): MqttClientLike {
  if (!client) {
    throw new Error('MQTT client not initialized. Call initMqttClient() first.');
  }
  return client;
}

export function initMqttClient(clientId: string): MqttClientLike {
  if (MQTT_MODE === 'mock') {
    const mock = new MockMqttClient(clientId);
    client = mock;
    return mock;
  }

  const real = mqtt.connect(BROKER_URL, {
    clientId,
    username: BROKER_USERNAME,
    password: BROKER_PASSWORD,
    keepalive: 30,
  });

  client = real;
  return real;
}

export function destroyMqttClient(): void {
  if (client) {
    if (MQTT_MODE === 'real') {
      (client as MqttClient).end(true);
    }
    client = null;
  }
}
```

- [ ] **Step 2: 创建 `src/mqtt/router.ts`**

```typescript
import type { MqttClientLike } from './client';
import { parseWaveformBinary } from '../utils/binary';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import { useAlarmStore } from '../stores/alarmStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import type { StateChangedEvent, WillMessage, DeviceAlarm, LowFreqSample } from './types';

export function setupMqttRouter(client: MqttClientLike): void {
  client.onMessage = (topic: string, payload: Uint8Array) => {
    if (topic.includes('/waveform/ch1')) {
      const data = parseWaveformBinary(payload.buffer as ArrayBuffer);
      useWaveformStore.getState().appendCh1(data, Date.now());
    } else if (topic.includes('/waveform/ch2')) {
      const data = parseWaveformBinary(payload.buffer as ArrayBuffer);
      useWaveformStore.getState().appendCh2(data, Date.now());
    } else if (topic.includes('/events/state_changed')) {
      const event = JSON.parse(new TextDecoder().decode(payload)) as StateChangedEvent;
      if (event.state?.collector) {
        useCollectorStore.getState().applyState(event.state.collector);
      }
      if (event.state?.laser) {
        useLaserStore.getState().applyState(event.state.laser);
      }
      // state_changed 到达意味着主控在线，清除遗嘱状态
      const mqttState = useMqttStore.getState();
      if (mqttState.willReceived) {
        mqttState.clearWill();
      }
    } else if (topic.includes('/events/will')) {
      const will = JSON.parse(new TextDecoder().decode(payload)) as WillMessage;
      const machineId = topic.split('/')[1];
      useMqttStore.getState().setWill(machineId);
    } else if (topic.includes('/events/device_alarm')) {
      const alarm = JSON.parse(new TextDecoder().decode(payload)) as DeviceAlarm;
      useAlarmStore.getState().add(alarm);
    } else if (topic.includes('/lowfreq')) {
      const sample = JSON.parse(new TextDecoder().decode(payload)) as LowFreqSample;
      useDataStore.getState().append(sample);
    } else {
      // RPC 响应由 rpc.ts 通过 onMessage 独立处理
    }
  };
}
```

- [ ] **Step 3: 创建 `src/mqtt/rpc.ts`**

```typescript
import type { MqttClientLike } from './client';
import { rpcRequestTopic, rpcResponsePattern } from './topics';
import { generateGuid } from '../utils/id';
import type { CommandResult } from './types';
import { handleMockRpc } from '../mock/mockRpc';
import { MQTT_MODE } from '../env';

interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  method: string;
}

const pendingRpcs = new Map<string, PendingRpc>();

export function setupRpcListener(client: MqttClientLike, machineId: string): void {
  const originalOnMessage = client.onMessage;

  client.onMessage = (topic: string, payload: Uint8Array) => {
    // 先检查 RPC 响应
    const match = topic.match(/\$rpc\/[^/]+\/[^/]+\/([^/]+)\/response/);
    if (match) {
      const corrId = match[1];
      const pending = pendingRpcs.get(corrId);
      if (pending) {
        clearTimeout(pending.timeout);
        pendingRpcs.delete(corrId);
        const result = JSON.parse(new TextDecoder().decode(payload)) as CommandResult;
        pending.resolve(result);
        return;
      }
    }

    // 非 RPC 消息继续走原有路由
    if (originalOnMessage) {
      originalOnMessage(topic, payload);
    }
  };
}

export function sendRpcCommand(
  client: MqttClientLike,
  machineId: string,
  method: string,
  payload?: object,
): Promise<CommandResult> {
  const corrId = generateGuid();
  const topic = rpcRequestTopic(machineId, method, corrId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRpcs.delete(corrId);
      reject(new Error('RPC 响应超时 (10s)'));
    }, 10000);

    pendingRpcs.set(corrId, { resolve, reject, timeout, method });

    if (MQTT_MODE === 'mock') {
      handleMockRpc(client, machineId, method, corrId);
    } else {
      const data = JSON.stringify(payload ?? {});
      client.publish(topic, data);
    }
  });
}

export function clearPendingRpcs(): void {
  for (const [corrId, pending] of pendingRpcs) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('MQTT 连接已断开'));
  }
  pendingRpcs.clear();
}
```

- [ ] **Step 4: 提交**

```bash
git add src/mqtt/client.ts src/mqtt/router.ts src/mqtt/rpc.ts
git commit -m "feat: add MQTT client, router, and RPC manager"
```

---

### Task 10: Zustand Stores

**Files:**
- Create: `src/stores/deviceStore.ts`, `src/stores/collectorStore.ts`, `src/stores/laserStore.ts`, `src/stores/waveformStore.ts`, `src/stores/dataStore.ts`, `src/stores/mqttStore.ts`, `src/stores/alarmStore.ts`

- [ ] **Step 1: 创建 `src/stores/deviceStore.ts`**

```typescript
import { create } from 'zustand';

export interface Device {
  id: string;
  name: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  isOnline: boolean;
}

interface DeviceStore {
  devices: Device[];
  selectedId: string | null;
  searchText: string;

  addDevice: (d: Device) => void;
  removeDevice: (id: string) => void;
  setSelected: (id: string) => void;
  setOnline: (id: string, online: boolean) => void;
  setSearch: (text: string) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  selectedId: null,
  searchText: '',

  addDevice: (d) =>
    set((s) => ({ devices: [...s.devices, d] })),
  removeDevice: (id) =>
    set((s) => ({
      devices: s.devices.filter((d) => d.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  setSelected: (id) => set({ selectedId: id }),
  setOnline: (id, online) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === id ? { ...d, isOnline: online } : d,
      ),
    })),
  setSearch: (text) => set({ searchText: text }),
}));
```

- [ ] **Step 2: 创建 `src/stores/collectorStore.ts`**

```typescript
import { create } from 'zustand';
import type { CollectorStateDto } from '../mqtt/types';

export type ButtonPhase = 'idle' | 'sending' | 'running' | 'error';

interface CollectorStore extends CollectorStateDto {
  openButtonPhase: ButtonPhase;
  startButtonPhase: ButtonPhase;

  applyState: (s: CollectorStateDto) => void;
  setDeviceOpened: (v: boolean) => void;
  setAcquiring: (v: boolean) => void;
  setButtonPhase: (btn: 'open' | 'start', phase: ButtonPhase) => void;
  reset: () => void;
}

const initial: CollectorStateDto & { openButtonPhase: ButtonPhase; startButtonPhase: ButtonPhase } = {
  processConnected: false,
  deviceOpened: false,
  acquiring: false,
  lastMessage: '',
  openButtonPhase: 'idle',
  startButtonPhase: 'idle',
};

export const useCollectorStore = create<CollectorStore>((set) => ({
  ...initial,

  applyState: (s) =>
    set({
      processConnected: s.processConnected,
      deviceOpened: s.deviceOpened,
      acquiring: s.acquiring,
      lastMessage: s.lastMessage ?? '',
    }),

  setDeviceOpened: (v) => set({ deviceOpened: v }),
  setAcquiring: (v) => set({ acquiring: v }),

  setButtonPhase: (btn, phase) =>
    set(btn === 'open' ? { openButtonPhase: phase } : { startButtonPhase: phase }),

  reset: () => set(initial),
}));
```

- [ ] **Step 3: 创建 `src/stores/laserStore.ts`**

```typescript
import { create } from 'zustand';
import type { LaserStateDto } from '../mqtt/types';
import type { ButtonPhase } from './collectorStore';

interface LaserStore extends LaserStateDto {
  connectButtonPhase: ButtonPhase;
  laserButtonPhase: ButtonPhase;

  applyState: (s: LaserStateDto) => void;
  setSerialConnected: (v: boolean) => void;
  setEmissionOn: (v: boolean) => void;
  setButtonPhase: (btn: 'connect' | 'laser', phase: ButtonPhase) => void;
  reset: () => void;
}

const initial: LaserStateDto & { connectButtonPhase: ButtonPhase; laserButtonPhase: ButtonPhase } = {
  serialConnected: false,
  emissionOn: false,
  portName: '',
  lastMessage: '',
  connectButtonPhase: 'idle',
  laserButtonPhase: 'idle',
};

export const useLaserStore = create<LaserStore>((set) => ({
  ...initial,

  applyState: (s) =>
    set({
      serialConnected: s.serialConnected,
      emissionOn: s.emissionOn,
      portName: s.portName ?? '',
      lastMessage: s.lastMessage ?? '',
    }),

  setSerialConnected: (v) => set({ serialConnected: v }),
  setEmissionOn: (v) => set({ emissionOn: v }),

  setButtonPhase: (btn, phase) =>
    set(btn === 'connect' ? { connectButtonPhase: phase } : { laserButtonPhase: phase }),

  reset: () => set(initial),
}));
```

- [ ] **Step 4: 创建 `src/stores/waveformStore.ts`**

```typescript
import { create } from 'zustand';

export interface WaveformFrame {
  timestamp: number;
  data: Float64Array;
}

const MAX_FRAMES = 200;

interface WaveformStore {
  ch1: WaveformFrame[];
  ch2: WaveformFrame[];

  appendCh1: (data: Float64Array, ts: number) => void;
  appendCh2: (data: Float64Array, ts: number) => void;
  clear: () => void;
}

export const useWaveformStore = create<WaveformStore>((set) => ({
  ch1: [],
  ch2: [],

  appendCh1: (data, ts) =>
    set((s) => ({
      ch1: s.ch1.length >= MAX_FRAMES
        ? [...s.ch1.slice(1), { timestamp: ts, data }]
        : [...s.ch1, { timestamp: ts, data }],
    })),

  appendCh2: (data, ts) =>
    set((s) => ({
      ch2: s.ch2.length >= MAX_FRAMES
        ? [...s.ch2.slice(1), { timestamp: ts, data }]
        : [...s.ch2, { timestamp: ts, data }],
    })),

  clear: () => set({ ch1: [], ch2: [] }),
}));
```

- [ ] **Step 5: 创建 `src/stores/dataStore.ts`**

```typescript
import { create } from 'zustand';
import type { LowFreqSample } from '../mqtt/types';

const MAX_SAMPLES = 500;

interface DataStore {
  samples: LowFreqSample[];

  append: (s: LowFreqSample) => void;
  clear: () => void;
}

export const useDataStore = create<DataStore>((set) => ({
  samples: [],

  append: (sample) =>
    set((s) => ({
      samples:
        s.samples.length >= MAX_SAMPLES
          ? [...s.samples.slice(1), sample]
          : [...s.samples, sample],
    })),

  clear: () => set({ samples: [] }),
}));
```

- [ ] **Step 6: 创建 `src/stores/mqttStore.ts`**

```typescript
import { create } from 'zustand';

interface MqttStore {
  mqttConnected: boolean;
  willReceived: boolean;
  willDeviceId: string | null;

  setConnected: (v: boolean) => void;
  setWill: (deviceId: string) => void;
  clearWill: () => void;
}

export const useMqttStore = create<MqttStore>((set) => ({
  mqttConnected: false,
  willReceived: false,
  willDeviceId: null,

  setConnected: (v) => set({ mqttConnected: v }),
  setWill: (deviceId) => set({ willReceived: true, willDeviceId: deviceId }),
  clearWill: () => set({ willReceived: false, willDeviceId: null }),
}));
```

- [ ] **Step 7: 创建 `src/stores/alarmStore.ts`**

```typescript
import { create } from 'zustand';
import type { DeviceAlarm } from '../mqtt/types';

interface AlarmStore {
  alarms: DeviceAlarm[];
  unreadCount: number;

  add: (a: DeviceAlarm) => void;
  markAllRead: () => void;
}

export const useAlarmStore = create<AlarmStore>((set) => ({
  alarms: [],
  unreadCount: 0,

  add: (a) =>
    set((s) => ({
      alarms: [a, ...s.alarms].slice(0, 200),
      unreadCount: s.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),
}));
```

- [ ] **Step 8: 提交**

```bash
git add src/stores/
git commit -m "feat: add all Zustand stores"
```

---

### Task 11: Hooks

**Files:**
- Create: `src/hooks/useClock.ts`, `src/hooks/useResizeObserver.ts`, `src/hooks/useMqttConnect.ts`, `src/hooks/useRpcCommand.ts`

- [ ] **Step 1: 创建 `src/hooks/useClock.ts`**

```typescript
import { useState, useEffect } from 'react';

export function useClock(): string {
  const [time, setTime] = useState(() => {
    const now = new Date();
    return formatTime(now);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(formatTime(new Date()));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return time;
}

function formatTime(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}
```

- [ ] **Step 2: 创建 `src/hooks/useResizeObserver.ts`**

```typescript
import { useEffect, useRef, useState, type RefObject } from 'react';

export function useContainerSize(): {
  ref: RefObject<HTMLDivElement | null>;
  width: number;
  height: number;
} {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, ...size };
}
```

- [ ] **Step 3: 创建 `src/hooks/useMqttConnect.ts`**

```typescript
import { useEffect, useRef } from 'react';
import { getMqttClient, initMqttClient, destroyMqttClient } from '../mqtt/client';
import { setupMqttRouter } from '../mqtt/router';
import { setupRpcListener, clearPendingRpcs } from '../mqtt/rpc';
import { useMqttStore } from '../stores/mqttStore';
import { useDeviceStore } from '../stores/deviceStore';
import {
  waveformCh1Topic,
  waveformCh2Topic,
  stateChangedTopic,
  willTopic,
  deviceAlarmTopic,
  lowFreqTopic,
  rpcResponsePattern,
} from '../mqtt/topics';
import type { MqttClientLike } from '../mqtt/client';
import { MQTT_MODE } from '../env';

export function useMqttConnect(): void {
  const initDone = useRef(false);

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    const client = initMqttClient('ui-client');

    client.onConnect = () => {
      useMqttStore.getState().setConnected(true);
      const selectedId = useDeviceStore.getState().selectedId;
      if (selectedId) {
        subscribeDevice(client, selectedId);
      }
    };

    client.onDisconnect = () => {
      useMqttStore.getState().setConnected(false);
      clearPendingRpcs();
    };

    setupMqttRouter(client);
    setupRpcListener(client, ''); // machineId 在 subscribeDevice 时动态设置

    client.connect();
    if (MQTT_MODE === 'mock') {
      // Mock 模式下立即触发 onConnect
      setTimeout(() => {
        client.onConnect?.();
      }, 50);
    }

    return () => {
      destroyMqttClient();
    };
  }, []);
}

export function subscribeDevice(client: MqttClientLike, machineId: string): void {
  client.subscribe(waveformCh1Topic(machineId));
  client.subscribe(waveformCh2Topic(machineId));
  client.subscribe(stateChangedTopic(machineId));
  client.subscribe(willTopic(machineId));
  client.subscribe(deviceAlarmTopic(machineId));
  client.subscribe(lowFreqTopic(machineId));
  client.subscribe(rpcResponsePattern(machineId));
}

export function unsubscribeDevice(client: MqttClientLike, machineId: string): void {
  client.unsubscribe(`daq/${machineId}/#`);
  client.unsubscribe(`$rpc/${machineId}/#`);
}
```

- [ ] **Step 4: 创建 `src/hooks/useRpcCommand.ts`**

```typescript
import { useCallback } from 'react';
import { getMqttClient } from '../mqtt/client';
import { sendRpcCommand as sendRpc } from '../mqtt/rpc';
import { useDeviceStore } from '../stores/deviceStore';
import type { CommandResult } from '../mqtt/types';

export function useRpcCommand(): {
  sendCommand: (method: string, payload?: object) => Promise<CommandResult>;
} {
  const sendCommand = useCallback(async (method: string, payload?: object) => {
    const selectedId = useDeviceStore.getState().selectedId;
    if (!selectedId) {
      throw new Error('未选中设备');
    }
    const client = getMqttClient();
    return sendRpc(client, selectedId, method, payload);
  }, []);

  return { sendCommand };
}
```

- [ ] **Step 5: 提交**

```bash
git add src/hooks/
git commit -m "feat: add hooks (useClock, useResizeObserver, useMqttConnect, useRpcCommand)"
```

---

### Task 12: 基础 UI 组件 — Navbar、Clock、MqttStatusIndicator

**Files:**
- Create: `src/components/Navbar.tsx`, `src/components/Navbar.module.css`, `src/components/Clock.tsx`, `src/components/MqttStatusIndicator.tsx`, `src/components/MqttStatusIndicator.module.css`

- [ ] **Step 1: 创建 `src/components/Navbar.module.css`**

```css
.navbar {
  height: 48px;
  display: flex;
  align-items: center;
  background: var(--app-navbar-bg);
  padding: 0 16px;
  flex-shrink: 0;
  z-index: 100;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  margin-right: 24px;
  cursor: pointer;
}

.tabs {
  flex: 1;
}

.tabs :global(.ant-tabs-nav) {
  margin-bottom: 0;
}

.tabs :global(.ant-tabs-nav .ant-tabs-tab) {
  color: rgba(255, 255, 255, 0.65);
}

.tabs :global(.ant-tabs-nav .ant-tabs-tab-active .ant-tabs-tab-btn) {
  color: #fff;
}

.right {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--navbar-text);
}
```

- [ ] **Step 2: 创建 `src/components/Navbar.tsx`**

```typescript
import { useNavigate, useLocation } from 'react-router-dom';
import { Tabs, Switch, Avatar } from 'antd';
import { DashboardOutlined, BellOutlined, HistoryOutlined, SettingOutlined, FileTextOutlined, UserOutlined } from '@ant-design/icons';
import styles from './Navbar.module.css';

const tabs = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据中心' },
  { key: '/alerts', icon: <BellOutlined />, label: '告警中心' },
  { key: '/history', icon: <HistoryOutlined />, label: '历史数据' },
  { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
  { key: '/logs', icon: <FileTextOutlined />, label: '日志查看' },
];

export function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeKey = '/' + location.pathname.split('/')[1] || '/dashboard';

  const handleToggleDark = (checked: boolean) => {
    document.body.classList.toggle('dark-theme', checked);
  };

  return (
    <div className={styles.navbar}>
      <div className={styles.logo} onClick={() => navigate('/dashboard')}>
        <DashboardOutlined />
        <span>数据采集与检测系统 V2.0</span>
      </div>
      <div className={styles.tabs}>
        <Tabs
          activeKey={activeKey}
          items={tabs.map((t) => ({ key: t.key, label: t.label, icon: t.icon }))}
          onChange={(key) => navigate(key)}
        />
      </div>
      <div className={styles.right}>
        <span>☀️</span>
        <Switch size="small" onChange={handleToggleDark} />
        <span>🌙</span>
        <Avatar size="small" icon={<UserOutlined />} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/components/Clock.tsx`**

```typescript
import { useClock } from '../hooks/useClock';

export function Clock() {
  const time = useClock();
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 500 }}>{time}</span>;
}
```

- [ ] **Step 4: 创建 `src/components/MqttStatusIndicator.module.css`**

```css
.indicators {
  display: flex;
  gap: 16px;
  align-items: center;
}

.item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.green { background: #52c41a; }
.red { background: #ff4d4f; }
.yellow { background: #faad14; }
.gray { background: #d9d9d9; }
```

- [ ] **Step 5: 创建 `src/components/MqttStatusIndicator.tsx`**

```typescript
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import styles from './MqttStatusIndicator.module.css';

export function MqttStatusIndicator() {
  const mqttConnected = useMqttStore((s) => s.mqttConnected);
  const willReceived = useMqttStore((s) => s.willReceived);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const processConnected = useCollectorStore((s) => s.processConnected);
  const laserConnected = useLaserStore((s) => s.serialConnected);

  const mqttOnline = mqttConnected && !willReceived;
  const collectorOnline = processConnected && mqttOnline;

  return (
    <div className={styles.indicators}>
      <div className={styles.item}>
        <span className={`${styles.dot} ${mqttOnline ? styles.green : styles.red}`} />
        <span>MQTT {mqttOnline ? '已连接' : (willReceived ? '遗嘱' : '未连接')}</span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${collectorOnline ? (acquiring ? styles.green : styles.yellow) : styles.gray}`} />
        <span>采集 {acquiring ? '采集中' : (collectorOnline ? '未采集' : '离线')}</span>
      </div>
      <div className={styles.item}>
        <span className={`${styles.dot} ${laserConnected ? styles.green : styles.gray}`} />
        <span>激光 {laserConnected ? '已连接' : '未连接'}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 提交**

```bash
git add src/components/Navbar.tsx src/components/Navbar.module.css \
        src/components/Clock.tsx \
        src/components/MqttStatusIndicator.tsx src/components/MqttStatusIndicator.module.css
git commit -m "feat: add Navbar, Clock, MqttStatusIndicator components"
```

---

### Task 13: 设备卡片与侧边栏

**Files:**
- Create: `src/components/DeviceCard.tsx`, `src/components/DeviceCard.module.css`, `src/components/Sidebar.tsx`, `src/components/Sidebar.module.css`

- [ ] **Step 1: 创建 `src/components/DeviceCard.module.css`**

```css
.card {
  padding: 10px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
}

.card:hover {
  background: var(--device-card-hover);
}

.active {
  background: var(--device-card-hover);
  border-color: #1890ff;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}

.subtitle {
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: 2px;
}

.statusDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}

.online { background: #52c41a; }
.offline { background: #ff4d4f; }
```

- [ ] **Step 2: 创建 `src/components/DeviceCard.tsx`**

```typescript
import type { Device } from '../stores/deviceStore';
import styles from './DeviceCard.module.css';

interface Props {
  device: Device;
  isSelected: boolean;
  onClick: () => void;
}

export function DeviceCard({ device, isSelected, onClick }: Props) {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.title}>
        <span className={`${styles.statusDot} ${device.isOnline ? styles.online : styles.offline}`} />
        <span>{device.name}</span>
      </div>
      <div className={styles.subtitle}>{device.id}</div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/components/Sidebar.module.css`**

```css
.sidebar {
  width: 250px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--app-sidebar-bg);
  border-right: 1px solid var(--statusbar-border);
  flex-shrink: 0;
}

.header {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.count {
  font-size: 13px;
  color: var(--text-secondary);
}

.list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px;
}

.footer {
  padding: 8px;
  border-top: 1px solid var(--statusbar-border);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
```

- [ ] **Step 4: 创建 `src/components/Sidebar.tsx`**

```typescript
import { Input, Button } from 'antd';
import { SearchOutlined, ScanOutlined, PlusOutlined } from '@ant-design/icons';
import { useDeviceStore } from '../stores/deviceStore';
import { DeviceCard } from './DeviceCard';
import styles from './Sidebar.module.css';

interface Props {
  onAutoDiscover: () => void;
  onManualAdd: () => void;
}

export function Sidebar({ onAutoDiscover, onManualAdd }: Props) {
  const devices = useDeviceStore((s) => s.devices);
  const selectedId = useDeviceStore((s) => s.selectedId);
  const searchText = useDeviceStore((s) => s.searchText);
  const setSelected = useDeviceStore((s) => s.setSelected);
  const setSearch = useDeviceStore((s) => s.setSearch);

  const filtered = devices.filter(
    (d) =>
      d.name.toLowerCase().includes(searchText.toLowerCase()) ||
      d.id.toLowerCase().includes(searchText.toLowerCase()),
  );

  const onlineCount = devices.filter((d) => d.isOnline).length;

  return (
    <div className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.count}>
          设备列表 ({onlineCount}/{devices.length})
        </div>
        <Input
          size="small"
          prefix={<SearchOutlined />}
          placeholder="搜索设备..."
          value={searchText}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
        />
      </div>

      <div className={styles.list}>
        {filtered.map((d) => (
          <DeviceCard
            key={d.id}
            device={d}
            isSelected={d.id === selectedId}
            onClick={() => setSelected(d.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary)' }}>
            暂无设备
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button icon={<ScanOutlined />} block onClick={onAutoDiscover}>
          自动发现
        </Button>
        <Button icon={<PlusOutlined />} block onClick={onManualAdd}>
          手动添加
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add src/components/DeviceCard.tsx src/components/DeviceCard.module.css \
        src/components/Sidebar.tsx src/components/Sidebar.module.css
git commit -m "feat: add DeviceCard and Sidebar"
```

---

### Task 14: 状态控制栏

**Files:**
- Create: `src/pages/Dashboard/StatusControlBar.tsx`, `src/pages/Dashboard/StatusControlBar.module.css`

- [ ] **Step 1: 创建 `src/pages/Dashboard/StatusControlBar.module.css`**

```css
.container {
  background: var(--statusbar-bg);
  border: 1px solid var(--statusbar-border);
  border-radius: 6px;
  padding: 12px 16px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.deviceInfo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.deviceName {
  font-size: 14px;
  font-weight: 600;
}

.deviceId {
  font-size: 12px;
  color: var(--text-secondary);
}

.row2 {
  display: flex;
  gap: 24px;
  align-items: center;
}

.group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.groupLabel {
  font-size: 12px;
  color: var(--text-secondary);
  margin-right: 4px;
}

.banner {
  margin-top: 10px;
  border-radius: 4px;
}
```

- [ ] **Step 2: 创建 `src/pages/Dashboard/StatusControlBar.tsx`**

```typescript
import { Button, Alert, message } from 'antd';
import { useDeviceStore } from '../../stores/deviceStore';
import { useCollectorStore } from '../../stores/collectorStore';
import { useLaserStore } from '../../stores/laserStore';
import { useMqttStore } from '../../stores/mqttStore';
import { useRpcCommand } from '../../hooks/useRpcCommand';
import { Clock } from '../../components/Clock';
import { MqttStatusIndicator } from '../../components/MqttStatusIndicator';
import styles from './StatusControlBar.module.css';

export function StatusControlBar() {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const collector = useCollectorStore();
  const laser = useLaserStore();
  const willReceived = useMqttStore((s) => s.willReceived);
  const willDeviceId = useMqttStore((s) => s.willDeviceId);
  const mqttConnected = useMqttStore((s) => s.mqttConnected);

  const { sendCommand } = useRpcCommand();

  const allDisabled = !mqttConnected || willReceived || !selectedId;

  const computeDisabled = () => {
    if (allDisabled) return { open: true, start: true, connect: true, laserEmit: true };

    const collectorOpen = collector.deviceOpened;
    const isAcquiring = collector.acquiring;
    const laserConnected = laser.serialConnected;
    const laserEmitting = laser.emissionOn;

    return {
      open: collectorOpen,
      close: !collectorOpen,
      start: isAcquiring,
      stop: !isAcquiring,
      connect: laserConnected,
      disconnect: !laserConnected,
      laserOn: laserEmitting || !laserConnected,
      laserOff: !laserEmitting || !laserConnected,
    };
  };

  const disabled = computeDisabled();

  const getButtonLabel = (phase: string, running: string, idle: string) => {
    if (phase === 'sending') return '发送中...';
    if (phase === 'running') return running;
    return idle;
  };

  const getButtonType = (phase: string, running: boolean) => {
    if (phase === 'sending') return undefined;
    if (phase === 'running') return 'primary';
    return 'default';
  };

  const handleRpc = async (
    method: string,
    setPhaseSending: () => void,
    setPhaseSuccess: () => void,
    setPhaseReset: () => void,
  ) => {
    setPhaseSending();
    try {
      const result = await sendCommand(method);
      if (result.success) {
        setPhaseSuccess();
      } else {
        setPhaseReset();
        message.error(result.message);
      }
    } catch {
      setPhaseReset();
      message.error('服务端无响应 (RPC 超时)');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.row1}>
        <div className={styles.deviceInfo}>
          {selectedDevice ? (
            <>
              <span className={styles.deviceName}>{selectedDevice.name}</span>
              <span className={styles.deviceId}>{selectedDevice.id}</span>
            </>
          ) : (
            <span className={styles.deviceId}>未选中设备</span>
          )}
          <MqttStatusIndicator />
        </div>
        <Clock />
      </div>

      <div className={styles.row2}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>采集卡</span>
          <Button
            size="small"
            type={getButtonType(collector.openButtonPhase, collector.deviceOpened)}
            danger={collector.openButtonPhase === 'running'}
            disabled={disabled.open}
            loading={collector.openButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-open-device',
                () => collector.setButtonPhase('open', 'sending'),
                () => { collector.setButtonPhase('open', 'running'); collector.setDeviceOpened(true); },
                () => collector.setButtonPhase('open', 'idle'),
              )
            }
          >
            {getButtonLabel(collector.openButtonPhase, '已打开', '打开采集卡')}
          </Button>
          <Button
            size="small"
            type={getButtonType(collector.startButtonPhase, collector.acquiring)}
            danger={collector.startButtonPhase === 'running'}
            disabled={disabled.start}
            loading={collector.startButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-start-ad',
                () => collector.setButtonPhase('start', 'sending'),
                () => { collector.setButtonPhase('start', 'running'); collector.setAcquiring(true); },
                () => collector.setButtonPhase('start', 'idle'),
              )
            }
          >
            {getButtonLabel(collector.startButtonPhase, '采集中', '开始采集')}
          </Button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>激光器</span>
          <Button
            size="small"
            type={getButtonType(laser.connectButtonPhase, laser.serialConnected)}
            disabled={disabled.connect}
            loading={laser.connectButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-connect',
                () => laser.setButtonPhase('connect', 'sending'),
                () => { laser.setButtonPhase('connect', 'running'); laser.setSerialConnected(true); },
                () => laser.setButtonPhase('connect', 'idle'),
              )
            }
          >
            {getButtonLabel(laser.connectButtonPhase, '已连接', '连接激光')}
          </Button>
          <Button
            size="small"
            type={getButtonType(laser.laserButtonPhase, laser.emissionOn)}
            danger={laser.laserButtonPhase === 'running'}
            disabled={disabled.laserOn}
            loading={laser.laserButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-on',
                () => laser.setButtonPhase('laser', 'sending'),
                () => { laser.setButtonPhase('laser', 'running'); laser.setEmissionOn(true); },
                () => laser.setButtonPhase('laser', 'idle'),
              )
            }
          >
            {getButtonLabel(laser.laserButtonPhase, '发射中', '开启激光')}
          </Button>
        </div>
      </div>

      {willReceived && (
        <div className={styles.banner}>
          <Alert
            type="error"
            showIcon
            message={`⚠️ 设备 [${willDeviceId}] 已离线，主控进程可能已崩溃或网络断开`}
            banner
          />
        </div>
      )}
      {!mqttConnected && !willReceived && (
        <div className={styles.banner}>
          <Alert
            type="warning"
            showIcon
            message="MQTT 连接断开，命令通道和状态通道均已中断"
            banner
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add src/pages/Dashboard/StatusControlBar.tsx src/pages/Dashboard/StatusControlBar.module.css
git commit -m "feat: add StatusControlBar with optimistic UI updates"
```

---

### Task 15: 图表组件 — 波形图 (uPlot)

**Files:**
- Create: `src/pages/Dashboard/components/WaveformChart.tsx`, `src/pages/Dashboard/components/WaveformChart.module.css`

- [ ] **Step 1: 创建 `src/pages/Dashboard/components/WaveformChart.module.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--chart-card-bg);
  border-radius: 6px;
  border-top: 3px solid var(--chart-card-border-top);
  padding: var(--chart-card-padding);
  overflow: hidden;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  flex-shrink: 0;
}

.chartWrap {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: 创建 `src/pages/Dashboard/components/WaveformChart.tsx`**

```typescript
import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { useWaveformStore } from '../../../stores/waveformStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './WaveformChart.module.css';

export function WaveformChart() {
  const { ref, width, height } = useContainerSize();
  const plotRef = useRef<HTMLDivElement | null>(null);
  const uPlotInstance = useRef<uPlot | null>(null);
  const ch1Data = useWaveformStore((s) => s.ch1);
  const ch2Data = useWaveformStore((s) => s.ch2);

  // 初始化 uPlot
  useEffect(() => {
    if (!plotRef.current || width === 0 || height === 0) return;

    if (uPlotInstance.current) {
      uPlotInstance.current.destroy();
    }

    const opts: uPlot.Options = {
      width,
      height: height - 24,
      scales: { x: { time: false }, y: {} },
      series: [
        {},
        { stroke: '#1890ff', width: 1, label: 'CH1' },
        { stroke: '#52c41a', width: 1, label: 'CH2' },
      ],
      axes: [
        { stroke: 'var(--text-secondary)', grid: { stroke: 'rgba(128,128,128,0.1)' } },
        { stroke: 'var(--text-secondary)', grid: { stroke: 'rgba(128,128,128,0.1)' } },
      ],
      cursor: { show: true },
      legend: { show: true },
    };

    const plot = new uPlot(opts, [[], [], []], plotRef.current);
    uPlotInstance.current = plot;

    return () => {
      plot.destroy();
      uPlotInstance.current = null;
    };
  }, [width, height]);

  // 更新数据
  useEffect(() => {
    const plot = uPlotInstance.current;
    if (!plot) return;

    const xs = ch1Data.map((_, i) => i);
    const y1 = ch1Data.map((f) => f.data[0]);
    const y2 = ch2Data.map((f) => f.data[0]);

    plot.setData([xs, y1, y2]);
  }, [ch1Data, ch2Data]);

  return (
    <div className={styles.container}>
      <div className={styles.title}>📈 双通道电压波形 (ch1/ch2)</div>
      <div className={styles.chartWrap} ref={ref}>
        <div ref={plotRef} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/pages/Dashboard/components/WaveformChart.tsx src/pages/Dashboard/components/WaveformChart.module.css
git commit -m "feat: add WaveformChart with uPlot"
```

---

### Task 16: 图表组件 — Vis 与 Cn² (ECharts)、六要素占位

**Files:**
- Create: `src/pages/Dashboard/components/VisChart.tsx`, `src/pages/Dashboard/components/Cn2Chart.tsx`, `src/pages/Dashboard/components/SixParamPlaceholder.tsx`, `src/pages/Dashboard/components/ChartCard.module.css`

- [ ] **Step 1: 创建 `src/pages/Dashboard/components/ChartCard.module.css`**

```css
.container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--chart-card-bg);
  border-radius: 6px;
  border-top: 3px solid var(--chart-card-border-top);
  padding: var(--chart-card-padding);
  overflow: hidden;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  flex-shrink: 0;
}

.chartWrap {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 2: 创建 `src/pages/Dashboard/components/VisChart.tsx`**

```typescript
import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function VisChart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);

  const timestamps = samples.map((s) => s.timestamp);
  const visValues = samples.map((s) => s.vis);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 50 },
    xAxis: { type: 'category' as const, data: timestamps, show: true },
    yAxis: { type: 'value' as const, name: 'km' },
    series: [
      {
        data: visValues,
        type: 'line' as const,
        smooth: true,
        lineStyle: { color: '#faad14', width: 2 },
        showSymbol: false,
        areaStyle: { color: 'rgba(250, 173, 20, 0.1)' },
      },
    ],
    animation: false,
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>📉 Vis 能见度</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/pages/Dashboard/components/Cn2Chart.tsx`**

```typescript
import ReactECharts from 'echarts-for-react';
import { useDataStore } from '../../../stores/dataStore';
import { useContainerSize } from '../../../hooks/useResizeObserver';
import styles from './ChartCard.module.css';

export function Cn2Chart() {
  const { ref, width, height } = useContainerSize();
  const samples = useDataStore((s) => s.samples);

  const timestamps = samples.map((s) => s.timestamp);
  const cn2Values = samples.map((s) => s.cn2);

  const option = {
    grid: { top: 10, right: 10, bottom: 30, left: 60 },
    xAxis: { type: 'category' as const, data: timestamps, show: true },
    yAxis: {
      type: 'value' as const,
      name: 'm⁻²/³',
      axisLabel: { formatter: (v: number) => v.toExponential(1) },
    },
    series: [
      {
        data: cn2Values,
        type: 'line' as const,
        smooth: true,
        lineStyle: { color: '#722ed1', width: 2 },
        showSymbol: false,
        areaStyle: { color: 'rgba(114, 46, 209, 0.1)' },
      },
    ],
    animation: false,
    tooltip: {
      trigger: 'axis' as const,
      formatter: (params: { value: number }[]) => {
        const v = params[0]?.value ?? 0;
        return `Cn²: ${v.toExponential(2)} m⁻²/³`;
      },
    },
  };

  return (
    <div className={styles.container}>
      <div className={styles.title}>📉 Cn² 折射率</div>
      <div className={styles.chartWrap} ref={ref}>
        {width > 0 && (
          <ReactECharts option={option} style={{ width, height: height - 24 }} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 `src/pages/Dashboard/components/SixParamPlaceholder.tsx`**

```typescript
import { Empty } from 'antd';
import styles from './ChartCard.module.css';

export function SixParamPlaceholder() {
  return (
    <div className={styles.container}>
      <div className={styles.title}>📊 多参数 (六要素)</div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="六要素数据暂不可用" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add src/pages/Dashboard/components/VisChart.tsx \
        src/pages/Dashboard/components/Cn2Chart.tsx \
        src/pages/Dashboard/components/SixParamPlaceholder.tsx \
        src/pages/Dashboard/components/ChartCard.module.css
git commit -m "feat: add VisChart, Cn2Chart (ECharts) and SixParamPlaceholder"
```

---

### Task 17: ChartGrid 与 Dashboard 数据页面

**Files:**
- Create: `src/pages/Dashboard/ChartGrid.tsx`, `src/pages/Dashboard/ChartGrid.module.css`, `src/pages/Dashboard/index.tsx`, `src/pages/Dashboard/dashboard.module.css`

- [ ] **Step 1: 创建 `src/pages/Dashboard/ChartGrid.module.css`**

```css
.grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 12px;
  min-height: 0;
}

.grid > * {
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 2: 创建 `src/pages/Dashboard/ChartGrid.tsx`**

```typescript
import { WaveformChart } from './components/WaveformChart';
import { VisChart } from './components/VisChart';
import { Cn2Chart } from './components/Cn2Chart';
import { SixParamPlaceholder } from './components/SixParamPlaceholder';
import styles from './ChartGrid.module.css';

export function ChartGrid() {
  return (
    <div className={styles.grid}>
      <WaveformChart />
      <VisChart />
      <SixParamPlaceholder />
      <Cn2Chart />
    </div>
  );
}
```

- [ ] **Step 3: 创建 `src/pages/Dashboard/dashboard.module.css`**

```css
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 12px;
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 4: 创建 `src/pages/Dashboard/index.tsx`**

```typescript
import { StatusControlBar } from './StatusControlBar';
import { ChartGrid } from './ChartGrid';
import styles from './dashboard.module.css';

export default function Dashboard() {
  return (
    <div className={styles.content}>
      <StatusControlBar />
      <ChartGrid />
    </div>
  );
}
```

- [ ] **Step 5: 提交**

```bash
git add src/pages/Dashboard/
git commit -m "feat: add ChartGrid and Dashboard page"
```

---

### Task 18: 弹窗 — 自动发现与手动添加

**Files:**
- Create: `src/components/modals/AutoDiscoverModal.tsx`, `src/components/modals/ManualAddModal.tsx`

- [ ] **Step 1: 创建 `src/components/modals/AutoDiscoverModal.tsx`**

```typescript
import { useState } from 'react';
import { Modal, Form, Input, InputNumber, Button, Table, message, Steps } from 'antd';
import { useDeviceStore, type Device } from '../../stores/deviceStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

const mockDiscoverMachines = [
  { machineId: 'daq-srv-01', online: true },
  { machineId: 'daq-srv-02', online: false },
  { machineId: 'daq-srv-03', online: true },
];

export function AutoDiscoverModal({ open, onClose }: Props) {
  const [step, setStep] = useState(0);
  const [scanning, setScanning] = useState(false);
  const [machines, setMachines] = useState<{ machineId: string; online: boolean }[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const addDevice = useDeviceStore((s) => s.addDevice);

  const handleScan = () => {
    setScanning(true);
    setTimeout(() => {
      setMachines(mockDiscoverMachines);
      setScanning(false);
      setStep(1);
    }, 1500);
  };

  const handleAdd = () => {
    for (const key of selectedKeys) {
      const m = machines.find((x) => x.machineId === key);
      if (!m) continue;
      const device: Device = {
        id: m.machineId,
        name: m.machineId,
        brokerUrl: 'mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883',
        port: 8883,
        username: '001',
        password: '001',
        tls: true,
        isOnline: m.online,
      };
      addDevice(device);
    }
    message.success(`已添加 ${selectedKeys.length} 台设备`);
    onClose();
    setStep(0);
    setMachines([]);
    setSelectedKeys([]);
  };

  const columns = [
    {
      title: 'MachineId',
      dataIndex: 'machineId' as const,
      key: 'machineId',
    },
    {
      title: '状态',
      dataIndex: 'online' as const,
      key: 'online',
      render: (v: boolean) => (v ? '🟢 在线' : '🔴 离线'),
    },
  ];

  return (
    <Modal
      title="自动发现设备"
      open={open}
      onCancel={() => {
        onClose();
        setStep(0);
        setMachines([]);
      }}
      footer={null}
      width={560}
    >
      <Steps
        size="small"
        current={step}
        style={{ marginBottom: 16 }}
        items={[
          { title: '连接 Broker' },
          { title: '扫描发现' },
          { title: '确认添加' },
        ]}
      />

      {step === 0 && (
        <Form layout="vertical">
          <Form.Item label="Broker 地址">
            <Input defaultValue="mqtts://z0d131fe.ala.cn-hangzhou.emqxsl.cn:8883" />
          </Form.Item>
          <Form.Item label="端口">
            <InputNumber defaultValue={8883} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="用户名">
            <Input defaultValue="001" />
          </Form.Item>
          <Form.Item label="密码">
            <Input.Password defaultValue="001" />
          </Form.Item>
          <Button type="primary" loading={scanning} onClick={handleScan} block>
            开始扫描
          </Button>
        </Form>
      )}

      {step === 1 && (
        <>
          <Table
            size="small"
            rowKey="machineId"
            columns={columns}
            dataSource={machines}
            rowSelection={{
              selectedRowKeys: selectedKeys,
              onChange: (keys) => setSelectedKeys(keys as string[]),
            }}
            pagination={false}
          />
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <Button type="primary" disabled={selectedKeys.length === 0} onClick={handleAdd}>
              添加选中设备 ({selectedKeys.length})
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
```

- [ ] **Step 2: 创建 `src/components/modals/ManualAddModal.tsx`**

```typescript
import { Modal, Form, Input, InputNumber, Switch, Button, message } from 'antd';
import { useDeviceStore, type Device } from '../../stores/deviceStore';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ManualAddModal({ open, onClose }: Props) {
  const [form] = Form.useForm();
  const addDevice = useDeviceStore((s) => s.addDevice);

  const handleSubmit = () => {
    form.validateFields().then((values) => {
      const device: Device = {
        id: values.machineId,
        name: values.name || values.machineId,
        brokerUrl: values.brokerUrl,
        port: values.port,
        username: values.username,
        password: values.password,
        tls: values.tls ?? false,
        isOnline: false,
      };
      addDevice(device);
      message.success(`设备 "${device.name}" 已添加`);
      form.resetFields();
      onClose();
    });
  };

  return (
    <Modal title="手动添加设备" open={open} onCancel={onClose} footer={null} width={480}>
      <Form form={form} layout="vertical" initialValues={{ port: 8883, tls: false }}>
        <Form.Item name="name" label="设备名称">
          <Input placeholder="如：一号高塔节点" />
        </Form.Item>
        <Form.Item name="machineId" label="MachineId" rules={[{ required: true, message: '请输入 MachineId' }]}>
          <Input placeholder="如：daq-srv-01" />
        </Form.Item>
        <Form.Item name="brokerUrl" label="Broker 地址" rules={[{ required: true, message: '请输入 Broker 地址' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="port" label="端口号">
          <InputNumber style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="username" label="用户名">
          <Input />
        </Form.Item>
        <Form.Item name="password" label="密码">
          <Input.Password />
        </Form.Item>
        <Form.Item name="tls" label="开启 TLS" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Button type="primary" block onClick={handleSubmit}>
          测试连接并保存
        </Button>
      </Form>
    </Modal>
  );
}
```

- [ ] **Step 3: 提交**

```bash
git add src/components/modals/
git commit -m "feat: add AutoDiscoverModal and ManualAddModal"
```

---

### Task 19: AppLayout 布局组件 + 占位页面

**Files:**
- Create: `src/layouts/AppLayout.tsx`, `src/layouts/AppLayout.module.css`
- Create: `src/pages/Alerts/index.tsx`, `src/pages/History/index.tsx`, `src/pages/Settings/index.tsx`, `src/pages/Logs/index.tsx`

- [ ] **Step 1: 创建 `src/layouts/AppLayout.module.css`**

```css
.layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
  background: var(--app-bg-color);
}

.body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
```

- [ ] **Step 2: 创建 `src/layouts/AppLayout.tsx`**

```typescript
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Sidebar } from '../components/Sidebar';
import { AutoDiscoverModal } from '../components/modals/AutoDiscoverModal';
import { ManualAddModal } from '../components/modals/ManualAddModal';
import { useMqttConnect } from '../hooks/useMqttConnect';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const [autoDiscoverOpen, setAutoDiscoverOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);

  useMqttConnect();

  return (
    <div className={styles.layout}>
      <Navbar />
      <div className={styles.body}>
        <Sidebar
          onAutoDiscover={() => setAutoDiscoverOpen(true)}
          onManualAdd={() => setManualAddOpen(true)}
        />
        <Outlet />
      </div>
      <AutoDiscoverModal
        open={autoDiscoverOpen}
        onClose={() => setAutoDiscoverOpen(false)}
      />
      <ManualAddModal
        open={manualAddOpen}
        onClose={() => setManualAddOpen(false)}
      />
    </div>
  );
}
```

- [ ] **Step 3: 创建各占位页面**

`src/pages/Alerts/index.tsx`:
```typescript
export default function Alerts() {
  return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>告警中心 — 开发中</div>;
}
```

`src/pages/History/index.tsx`:
```typescript
export default function History() {
  return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>历史数据 — 开发中</div>;
}
```

`src/pages/Settings/index.tsx`:
```typescript
export default function Settings() {
  return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>系统设置 — 开发中</div>;
}
```

`src/pages/Logs/index.tsx`:
```typescript
export default function Logs() {
  return <div style={{ padding: 24, color: 'var(--text-secondary)' }}>日志查看 — 开发中</div>;
}
```

- [ ] **Step 4: 提交**

```bash
git add src/layouts/ src/pages/Alerts/ src/pages/History/ src/pages/Settings/ src/pages/Logs/
git commit -m "feat: add AppLayout and placeholder pages"
```

---

### Task 20: App.tsx、main.tsx 根组装

**Files:**
- Create: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: 创建 `src/App.tsx`**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antdTheme } from 'antd';
import { AppLayout } from './layouts/AppLayout';
import Dashboard from './pages/Dashboard';
import Alerts from './pages/Alerts';
import History from './pages/History';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import { useState, useEffect } from 'react';

export default function App() {
  const [isDark, setIsDark] = useState(
    () => document.body.classList.contains('dark-theme'),
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.body.classList.contains('dark-theme'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: { colorPrimary: '#1890ff', borderRadius: 4 },
      }}
    >
      <BrowserRouter>
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
      </BrowserRouter>
    </ConfigProvider>
  );
}
```

- [ ] **Step 2: 创建 `src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './assets/styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 3: 创建 `src/vite-env.d.ts`**

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MQTT_MODE: string;
  readonly VITE_BROKER_URL: string;
  readonly VITE_BROKER_USERNAME: string;
  readonly VITE_BROKER_PASSWORD: string;
  readonly VITE_DEFAULT_MACHINE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

- [ ] **Step 4: 验证开发服务器启动**

```bash
pnpm dev
```

预期：Vite dev server 正常启动，浏览器访问后看到完整布局（导航栏 + 侧边栏 + 数据中心页面）。Mock 模式下侧边栏暂无设备，通过手动添加/自动发现添加设备后可切换。

- [ ] **Step 5: 提交**

```bash
git add src/App.tsx src/main.tsx src/vite-env.d.ts
git commit -m "feat: add App, main entry, and Vite env types"
```

---

### Task 21: 端到端验证与 Mock 联调

- [ ] **Step 1: 启动开发服务器**

```bash
pnpm dev
```

- [ ] **Step 2: 手动验证清单**

1. 页面加载：导航栏、侧边栏、数据中心三个区域正常渲染
2. 暗色模式：点击 Switch → body class 切换 → CSS 变量生效
3. 手动添加设备：填写表单 → 提交 → 侧边栏出现设备卡片
4. 自动发现：扫描 → 列表出现 → 勾选添加
5. 设备切换：点击卡片 → 右侧状态栏显示对应设备信息
6. Mock 波形数据：100ms 模拟数据推送 → 波形图实时更新
7. Mock 低频数据：7s Vis/Cn² 数据 → ECharts 图表更新
8. 控制按钮：点击"开始采集" → 发送中 → 绿灯采集中
9. 遗嘱模拟（手动触发 injectWill）：红色 Banner + 按钮全禁用
10. RPC 超时：Mock 不发送响应 → 10s 后按钮回退 + 错误提示

- [ ] **Step 3: 修复验证中发现的问题**

---
