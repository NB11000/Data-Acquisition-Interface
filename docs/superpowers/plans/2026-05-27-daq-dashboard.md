# 数据采集与检测系统 V2.0 前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建数据采集与检测系统 V2.0 的 React+TypeScript 前端页面，支持 MQTT 通信、强乐观 UI 交互、高频波形渲染和深浅色主题切换。

**Architecture:** 三层分层架构 — `data/` 纯 TS 数据层 (不依赖 React) → `hooks/` React 适配层 → `components/` UI 层。热数据 (>10Hz 波形) 通过 uPlot 命令式渲染不进 React state；温数据 (7s 低频) 通过 observable store → leaf setState；冷数据 (状态事件) 走 React state。

**Tech Stack:** Vite + React 19 + TypeScript + Ant Design 6 + uPlot + mqtt.js + CSS Modules

---

## 前置条件

Phase 1 (项目骨架 + 布局) 已完成:
- Vite 项目已初始化，依赖已安装 (`antd`, `uplot`, `mqtt`)
- `src/styles/variables.css` 浅/深色 CSS 变量已就绪
- `src/styles/global.css` 全局重置已就绪
- `src/components/common/ThemeSwitch.tsx` 主题切换已就绪
- `src/components/layout/Navbar.tsx` 导航栏已就绪
- `src/components/layout/Sidebar.tsx` 侧边栏占位已就绪
- `src/components/layout/AppLayout.tsx` 主布局已就绪
- `src/components/charts/ChartGrid.tsx` 2x2 占位卡片已就绪
- `src/components/control/StatusControlBar.tsx` 状态控制栏占位已就绪
- `src/App.tsx`, `src/main.tsx` 入口已就绪
- Dev server 可正常启动 (http://localhost:3000)

---

## Phase 2: 数据层

### Task 2.1: TypeScript 类型定义

**Files:**
- Create: `src/data/types/mqtt.ts`
- Create: `src/data/types/state.ts`
- Create: `src/data/types/commands.ts`

**状态:** ✅ 已完成

这些文件包含 MQTT 连接配置、RPC 方法枚举、SystemStateDto 全量状态类型、CommandResult 响应类型、ButtonDisabledMap、设备信息、低频采样数据等完整类型定义。

---

### Task 2.2: 环形缓冲区

**Files:**
- Create: `src/utils/ring-buffer.ts`

- [ ] 实现 `RingBuffer` 类 — 预分配 `Float64Array` 的环形缓冲区

```typescript
export class RingBuffer {
  private buffer: Float64Array;
  private capacity: number;
  private frameSize: number;
  private writeIndex = 0;

  constructor(frameSize: number, maxFrames: number) {
    this.frameSize = frameSize;
    this.capacity = maxFrames;
    this.buffer = new Float64Array(frameSize * maxFrames);
  }

  push(frame: Float64Array | number[]): number {
    const offset = this.writeIndex * this.frameSize;
    if (frame instanceof Float64Array) {
      this.buffer.set(frame, offset);
    } else {
      for (let i = 0; i < Math.min(frame.length, this.frameSize); i++) {
        this.buffer[offset + i] = frame[i];
      }
    }
    const idx = this.writeIndex;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    return idx;
  }

  getRawBuffer(): Float64Array { return this.buffer; }
  getFrameSize(): number { return this.frameSize; }
  getCapacity(): number { return this.capacity; }
  getWriteIndex(): number { return this.writeIndex; }

  getRecentFrames(count: number): Float64Array[] {
    const frames: Float64Array[] = [];
    const actual = Math.min(count, this.capacity);
    for (let i = 0; i < actual; i++) {
      const idx = (this.writeIndex - actual + i + this.capacity) % this.capacity;
      const offset = idx * this.frameSize;
      frames.push(this.buffer.slice(offset, offset + this.frameSize));
    }
    return frames;
  }

  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }
}
```

- [ ] 验证：`npm run dev` 确保编译通过

---

### Task 2.3: 二进制解析 & RPC ID 生成

**Files:**
- Create: `src/utils/binary-parser.ts`
- Create: `src/utils/rpc-id.ts`

- [ ] 实现波形二进制解析

```typescript
// src/utils/binary-parser.ts

/** 解析波形二进制负载: double[1000] 小端序 → Float64Array */
export function parseWaveformBinary(payload: Uint8Array): Float64Array {
  if (payload.byteLength < 8000) {
    throw new Error(`波形数据长度不足: ${payload.byteLength} < 8000`);
  }
  // 使用底层 buffer 创建 Float64Array 视图，零拷贝
  const buffer = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  );
  return new Float64Array(buffer, 0, 1000);
}
```

```typescript
// src/utils/rpc-id.ts

export function generateRpcId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}
```

- [ ] 验证：`npm run dev` 确认编译无错误

---

### Task 2.4: MQTT 客户端

**Files:**
- Create: `src/data/mqtt/client.ts`

- [ ] 实现 `MqttClientManager` 单例 — 管理 MQTT 连接生命周期

```typescript
// src/data/mqtt/client.ts
import mqtt, { MqttClient } from 'mqtt';
import type { MqttConnectionConfig } from '../types/mqtt';

type ConnectionHandler = (connected: boolean) => void;
type MessageHandler = (topic: string, payload: Buffer) => void;

export class MqttClientManager {
  private static instance: MqttClientManager;
  private client: MqttClient | null = null;
  private config: MqttConnectionConfig | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private subscribed = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  static getInstance(): MqttClientManager {
    if (!MqttClientManager.instance) {
      MqttClientManager.instance = new MqttClientManager();
    }
    return MqttClientManager.instance;
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  get currentConfig(): MqttConnectionConfig | null {
    return this.config;
  }

  async connect(config: MqttConnectionConfig): Promise<void> {
    this.destroyed = false;
    this.config = config;

    const url = config.brokerUrl.startsWith('mqtt')
      ? config.brokerUrl
      : `mqtts://${config.brokerUrl}:${config.port ?? 8883}`;

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, {
        clientId: config.clientId ?? `ui-${Date.now()}`,
        username: config.username,
        password: config.password,
        keepalive: 30,
        connectTimeout: 10000,
        rejectUnauthorized: false,
      });

      this.client.on('connect', () => {
        this.notifyConnection(true);
        resolve();
      });

      this.client.on('error', (err) => {
        if (!this.client?.connected) reject(err);
      });

      this.client.on('message', (topic, payload) => {
        for (const handler of this.messageHandlers) {
          handler(topic, payload);
        }
      });

      this.client.on('close', () => {
        this.notifyConnection(false);
        this.tryReconnect();
      });
    });
  }

  private tryReconnect(): void {
    if (this.destroyed || !this.config) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed && this.config) {
        this.connect(this.config).catch(() => {});
      }
    }, 3000);
  }

  subscribe(topics: string[], qos: 0 | 1 = 1): void {
    const newTopics = topics.filter((t) => !this.subscribed.has(t));
    if (newTopics.length === 0) return;
    this.client?.subscribe(newTopics, { qos }, (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else newTopics.forEach((t) => this.subscribed.add(t));
    });
  }

  unsubscribe(topics: string[]): void {
    const existing = topics.filter((t) => this.subscribed.has(t));
    if (existing.length === 0) return;
    this.client?.unsubscribe(existing, undefined, (err) => {
      if (err) console.error('MQTT unsubscribe error:', err);
      else existing.forEach((t) => this.subscribed.delete(t));
    });
    for (const t of existing) this.subscribed.delete(t);
  }

  publish(topic: string, payload: object | string, qos: 0 | 1 = 1): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.client?.publish(topic, data, { qos }, (err) => {
      if (err) console.error('MQTT publish error:', err);
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.unsubscribe([...this.subscribed]);
    this.client?.end(true);
    this.client = null;
    this.config = null;
  }
}
```

- [ ] 验证：`npm run dev` 确认编译无错误

---

### Task 2.5: Topic Router

**Files:**
- Create: `src/data/mqtt/topic-router.ts`

- [ ] 实现 MQTT 主题路由分发

```typescript
// src/data/mqtt/topic-router.ts
import { MqttClientManager } from './client';
import type { RpcMethod } from '../types/mqtt';

type EventHandler = (topic: string, payload: Buffer) => void;

interface RouteEntry {
  pattern: RegExp;
  handler: EventHandler;
}

export class TopicRouter {
  private routes: RouteEntry[] = [];
  private cleanupFn: (() => void) | null = null;

  constructor(private machineId: string) {}

  /** 注册路由: pattern 为包含捕获组的正则表达式 */
  on(pattern: RegExp, handler: EventHandler): void {
    this.routes.push({ pattern, handler });
  }

  /** 启动路由监听 */
  start(): void {
    const client = MqttClientManager.getInstance();
    this.cleanupFn = client.onMessage((topic, payload) => {
      for (const route of this.routes) {
        if (route.pattern.test(topic)) {
          route.handler(topic, payload);
          return; // 首个匹配
        }
      }
    });
  }

  /** 停止路由监听 */
  stop(): void {
    this.cleanupFn?.();
    this.cleanupFn = null;
    this.routes = [];
  }
}
```

- [ ] 验证：`npm run dev` 确认编译通过

---

### Task 2.6: RPC Manager

**Files:**
- Create: `src/data/mqtt/rpc-manager.ts`

- [ ] 实现 RPC 请求/响应管理，含 10s 超时

```typescript
// src/data/mqtt/rpc-manager.ts
import { MqttClientManager } from './client';
import { generateRpcId } from '../../utils/rpc-id';
import type { CommandResult } from '../types/commands';
import type { RpcMethod } from '../types/mqtt';

interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class RpcManager {
  private pending = new Map<string, PendingRpc>();
  private cleanupFn: (() => void) | null = null;
  private responsePattern: RegExp;

  constructor(private machineId: string) {
    this.responsePattern = new RegExp(
      `^\\$rpc\\/${machineId}\\/.+\\/(.+)\\/response$`
    );
  }

  /** 发送 RPC 请求，返回 Promise<CommandResult> */
  send(method: RpcMethod, payload?: object): Promise<CommandResult> {
    const corrId = generateRpcId();
    const topic = `$rpc/${this.machineId}/${method}/${corrId}`;
    const client = MqttClientManager.getInstance();

    return new Promise<CommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(corrId);
        reject(new Error(`RPC 响应超时 (10s): ${method}`));
      }, 10000);

      this.pending.set(corrId, { resolve, reject, timeout });
      client.publish(topic, payload ?? {}, 1);
    });
  }

  /** 启动响应监听 */
  start(): void {
    const client = MqttClientManager.getInstance();
    this.cleanupFn = client.onMessage((topic, payload) => {
      const match = topic.match(this.responsePattern);
      if (!match) return;

      const corrId = match[1];
      const pending = this.pending.get(corrId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pending.delete(corrId);

      try {
        const result = JSON.parse(payload.toString()) as CommandResult;
        pending.resolve(result);
      } catch (err) {
        pending.reject(new Error('RPC 响应解析失败'));
      }
    });
  }

  /** 取消所有待处理请求 */
  stop(): void {
    this.cleanupFn?.();
    this.cleanupFn = null;
    for (const [corrId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('RPC 管理器已停止'));
      this.pending.delete(corrId);
    }
  }
}
```

- [ ] 验证：`npm run dev` 确认编译通过

---

### Task 2.7: 数据 Stores

**Files:**
- Create: `src/data/stores/waveform-store.ts`
- Create: `src/data/stores/lowfreq-store.ts`
- Create: `src/data/stores/state-store.ts`
- Create: `src/data/stores/alarm-store.ts`

- [ ] 波形 Store — 封装双通道 RingBuffer

```typescript
// src/data/stores/waveform-store.ts
import { RingBuffer } from '../../utils/ring-buffer';

const FRAME_SIZE = 1000;
const MAX_FRAMES = 200;

export class WaveformStore {
  ch1 = new RingBuffer(FRAME_SIZE, MAX_FRAMES);
  ch2 = new RingBuffer(FRAME_SIZE, MAX_FRAMES);

  pushCh1(frame: Float64Array): void { this.ch1.push(frame); }
  pushCh2(frame: Float64Array): void { this.ch2.push(frame); }

  clear(): void {
    this.ch1.clear();
    this.ch2.clear();
  }
}

export const waveformStore = new WaveformStore();
```

- [ ] 低频采样 Store — Observable 模式

```typescript
// src/data/stores/lowfreq-store.ts
import type { LowFreqSample } from '../types/commands';

type Listener = (sample: LowFreqSample) => void;

export class LowFreqStore {
  private listeners = new Set<Listener>();
  private _latest: LowFreqSample | null = null;

  get latest(): LowFreqSample | null { return this._latest; }

  push(sample: LowFreqSample): void {
    this._latest = sample;
    for (const listener of this.listeners) {
      listener(sample);
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void { this._latest = null; }
}

export const lowfreqStore = new LowFreqStore();
```

- [ ] 系统状态 Store

```typescript
// src/data/stores/state-store.ts
import type { SystemStateDto, StateChangedEvent, ButtonDisabledMap } from '../types/state';

type StateListener = (state: SystemStateDto) => void;

export class StateStore {
  private listeners = new Set<StateListener>();
  private _state: SystemStateDto | null = null;

  get state(): SystemStateDto | null { return this._state; }

  updateFromEvent(event: StateChangedEvent): void {
    if (event.state) {
      this._state = event.state;
      for (const listener of this.listeners) {
        listener(event.state);
      }
    }
  }

  setState(state: SystemStateDto): void {
    this._state = state;
    for (const listener of this.listeners) {
      listener(state);
    }
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void { this._state = null; }
}

export const stateStore = new StateStore();
```

- [ ] 告警 Store

```typescript
// src/data/stores/alarm-store.ts
import type { DeviceAlarmPayload, DetectionAlertPayload } from '../types/commands';

type AlarmListener = (alarm: DeviceAlarmPayload | DetectionAlertPayload) => void;

export class AlarmStore {
  private listeners = new Set<AlarmListener>();
  private _latest: (DeviceAlarmPayload | DetectionAlertPayload) | null = null;

  get latest() { return this._latest; }

  push(alarm: DeviceAlarmPayload | DetectionAlertPayload): void {
    this._latest = alarm;
    for (const listener of this.listeners) {
      listener(alarm);
    }
  }

  subscribe(listener: AlarmListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clear(): void { this._latest = null; }
}

export const alarmStore = new AlarmStore();
```

- [ ] 验证：`npm run dev` 确认编译通过

---

## Phase 3: Hooks 适配层

### Task 3.1: useResizeObserver

**Files:**
- Create: `src/hooks/useResizeObserver.ts`

```typescript
import { useRef, useState, useEffect, useCallback } from 'react';

export function useResizeObserver(): [
  React.RefObject<HTMLDivElement | null>,
  { width: number; height: number },
] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const rect = entries[0]?.contentRect;
        if (rect) {
          setSize((prev) => {
            if (prev.width === Math.floor(rect.width) && prev.height === Math.floor(rect.height)) {
              return prev;
            }
            return { width: Math.floor(rect.width), height: Math.floor(rect.height) };
          });
        }
      });
    });

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return [ref, size];
}
```

---

### Task 3.2: useTheme

**Files:**
- Create: `src/hooks/useTheme.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';

const DARK_CLASS = 'dark-theme';
const STORAGE_KEY = 'app-theme';

export function useTheme() {
  const [dark, setDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(STORAGE_KEY) === 'dark';
  });

  useEffect(() => {
    document.body.classList.toggle(DARK_CLASS, dark);
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
  }, [dark]);

  const toggle = useCallback(() => setDark((prev) => !prev), []);

  return { dark, toggle };
}
```

注意: 这个 hook 需要同步到 `ThemeSwitch.tsx` 重构使用。

---

### Task 3.3: useSystemState

**Files:**
- Create: `src/hooks/useSystemState.ts`

```typescript
import { useState, useEffect, useCallback } from 'react';
import { stateStore } from '../data/stores/state-store';
import type { SystemStateDto, ButtonDisabledMap } from '../data/types/state';

export function computeButtonDisabled(
  isConnected: boolean,
  collectorState: { isOpen: boolean } | null,
  laserState: { isConnected: boolean; emissionOn: boolean } | null,
  isCollecting: boolean
): ButtonDisabledMap {
  if (!isConnected) {
    return {
      openCollector: true, closeCollector: true,
      startAcquisition: true, stopAcquisition: true,
      connectLaser: true, disconnectLaser: true,
      laserOn: true, laserOff: true,
    };
  }

  const collectorOpen = collectorState?.isOpen ?? false;
  const laserConnected = laserState?.isConnected ?? false;
  const laserEmitting = laserState?.emissionOn ?? false;

  return {
    openCollector: collectorOpen,
    closeCollector: !collectorOpen,
    startAcquisition: isCollecting,
    stopAcquisition: !isCollecting,
    connectLaser: laserConnected,
    disconnectLaser: !laserConnected,
    laserOn: laserEmitting || !laserConnected,
    laserOff: !laserEmitting || !laserConnected,
  };
}

export function useSystemState() {
  const [systemState, setSystemState] = useState<SystemStateDto | null>(stateStore.state);
  const [buttonDisabled, setButtonDisabled] = useState<ButtonDisabledMap>(() =>
    computeButtonDisabled(false, null, null, false)
  );

  useEffect(() => {
    return stateStore.subscribe((state) => {
      setSystemState(state);
      const disabled = computeButtonDisabled(
        state.collector?.processConnected ?? false,
        state.collector ? { isOpen: state.collector.deviceOpened } : null,
        state.laser ? { isConnected: state.laser.serialConnected, emissionOn: state.laser.emissionOn } : null,
        state.collector?.acquiring ?? false
      );
      setButtonDisabled(disabled);
    });
  }, []);

  const setOffline = useCallback(() => {
    setButtonDisabled({
      openCollector: true, closeCollector: true,
      startAcquisition: true, stopAcquisition: true,
      connectLaser: true, disconnectLaser: true,
      laserOn: true, laserOff: true,
    });
  }, []);

  return { systemState, buttonDisabled, setOffline };
}
```

---

### Task 3.4: useMqttConnection

**Files:**
- Create: `src/hooks/useMqttConnection.ts`

```typescript
import { useState, useCallback, useEffect, useRef } from 'react';
import { MqttClientManager } from '../data/mqtt/client';
import { TopicRouter } from '../data/mqtt/topic-router';
import { RpcManager } from '../data/mqtt/rpc-manager';
import { TOPIC, RpcMethod } from '../data/types/mqtt';
import { stateStore } from '../data/stores/state-store';
import { waveformStore } from '../data/stores/waveform-store';
import { lowfreqStore } from '../data/stores/lowfreq-store';
import { alarmStore } from '../data/stores/alarm-store';
import { parseWaveformBinary } from '../utils/binary-parser';
import type { SystemStateDto } from '../data/types/state';
import type { LowFreqSample, DeviceAlarmPayload, WillMessagePayload } from '../data/types/commands';

export function useMqttConnection() {
  const [connected, setConnected] = useState(false);
  const [willTriggered, setWillTriggered] = useState(false);
  const routerRef = useRef<TopicRouter | null>(null);
  const rpcRef = useRef<RpcManager | null>(null);

  const connect = useCallback(async (config: {
    brokerUrl: string; username: string; password: string;
    machineId: string; port?: number;
  }) => {
    // 断开旧连接
    disconnect();

    const client = MqttClientManager.getInstance();
    const router = new TopicRouter(config.machineId);
    const rpc = new RpcManager(config.machineId);
    routerRef.current = router;
    rpcRef.current = rpc;

    await client.connect({
      brokerUrl: config.brokerUrl,
      username: config.username,
      password: config.password,
      machineId: config.machineId,
      port: config.port,
    });

    // 订阅事件主题
    client.subscribe([
      TOPIC.STATE_CHANGED(config.machineId),
      TOPIC.WILL(config.machineId),
      TOPIC.DEVICE_ALARM(config.machineId),
      TOPIC.WAVEFORM_CH1(config.machineId),
      TOPIC.WAVEFORM_CH2(config.machineId),
      TOPIC.LOWFREQ(config.machineId),
      TOPIC.RPC_RESPONSE_PATTERN(config.machineId),
    ]);

    // 注册 TopicRouter
    router.on(/\/events\/state_changed$/, (_, payload) => {
      const event = JSON.parse(payload.toString());
      stateStore.updateFromEvent(event);
    });

    router.on(/\/events\/will$/, (_, payload) => {
      const willMsg: WillMessagePayload = JSON.parse(payload.toString());
      setWillTriggered(true);
      stateStore.clear();
      // 所有按钮将在 UI 层通过 setOffline 禁用
    });

    router.on(/\/events\/device_alarm$/, (_, payload) => {
      const alarm: DeviceAlarmPayload = JSON.parse(payload.toString());
      alarmStore.push(alarm);
    });

    router.on(/\/waveform\/ch1$/, (_, payload) => {
      const frame = parseWaveformBinary(new Uint8Array(payload));
      waveformStore.pushCh1(frame);
    });

    router.on(/\/waveform\/ch2$/, (_, payload) => {
      const frame = parseWaveformBinary(new Uint8Array(payload));
      waveformStore.pushCh2(frame);
    });

    router.on(/\/lowfreq$/, (_, payload) => {
      const sample: LowFreqSample = JSON.parse(payload.toString());
      lowfreqStore.push(sample);
    });

    router.start();
    rpc.start();

    setConnected(true);
    setWillTriggered(false);

    // 主动拉取初始状态快照
    try {
      const result = await rpc.send(RpcMethod.SYSTEM_STATE);
      if (result.success && result.state) {
        stateStore.setState(result.state as unknown as SystemStateDto);
      }
    } catch {
      console.warn('SYSTEM_STATE RPC 超时，设备保持离线状态');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (rpcRef.current) { rpcRef.current.stop(); rpcRef.current = null; }
    if (routerRef.current) { routerRef.current.stop(); routerRef.current = null; }
    waveformStore.clear();
    lowfreqStore.clear();
    stateStore.clear();
    alarmStore.clear();
    MqttClientManager.getInstance().disconnect();
    setConnected(false);
    setWillTriggered(false);
  }, []);

  useEffect(() => {
    return () => disconnect();
  }, [disconnect]);

  return {
    connected,
    willTriggered,
    connect,
    disconnect,
    rpcManager: rpcRef.current,
  };
}
```

---

### Task 3.5: useWaveformData, useLowFreqData, useRpcCommand

**Files:**
- Create: `src/hooks/useWaveformData.ts`
- Create: `src/hooks/useLowFreqData.ts`
- Create: `src/hooks/useRpcCommand.ts`

```typescript
// src/hooks/useWaveformData.ts
import { useRef } from 'react';
import { waveformStore } from '../data/stores/waveform-store';

export function useWaveformData() {
  // 返回 store ref，不触发 React render。图表通过 rAF 命令式读取
  const storeRef = useRef(waveformStore);
  return storeRef;
}
```

```typescript
// src/hooks/useLowFreqData.ts
import { useState, useEffect } from 'react';
import { lowfreqStore } from '../data/stores/lowfreq-store';
import type { LowFreqSample } from '../data/types/commands';

export function useLowFreqData() {
  const [sample, setSample] = useState<LowFreqSample | null>(lowfreqStore.latest);

  useEffect(() => {
    return lowfreqStore.subscribe(setSample);
  }, []);

  return sample;
}
```

```typescript
// src/hooks/useRpcCommand.ts
import { useState, useCallback, useRef } from 'react';
import { RpcManager } from '../data/mqtt/rpc-manager';
import type { RpcMethod } from '../data/types/mqtt';
import type { ButtonPhase } from '../data/types/commands';

export function useRpcCommand(rpcManager: RpcManager | null) {
  const [phase, setPhase] = useState<Record<string, ButtonPhase>>({});

  const send = useCallback(async (method: RpcMethod, label: string) => {
    if (!rpcManager) return;

    setPhase((prev) => ({ ...prev, [label]: 'sending' }));

    try {
      const result = await rpcManager.send(method);
      setPhase((prev) => ({
        ...prev,
        [label]: result.success ? 'running' : 'idle',
      }));
      return result;
    } catch {
      setPhase((prev) => ({ ...prev, [label]: 'error' }));
      // 抖动后回退
      setTimeout(() => {
        setPhase((prev) => ({ ...prev, [label]: 'idle' }));
      }, 600);
      return null;
    }
  }, [rpcManager]);

  return { phase, send };
}
```

---

## Phase 4: 设备管理

### Task 4.1: DeviceCard 组件

**Files:**
- Create: `src/components/sidebar/DeviceCard.tsx`

```typescript
import type { DeviceInfo } from '../../data/types/commands';

interface DeviceCardProps {
  device: DeviceInfo;
  selected: boolean;
  onClick: () => void;
}

export default function DeviceCard({ device, selected, onClick }: DeviceCardProps) {
  const statusColor = device.status === 'online'
    ? 'var(--app-status-online)'
    : device.status === 'offline'
      ? 'var(--app-status-offline)'
      : 'var(--app-text-hint)';

  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        background: selected ? 'var(--app-nav-active)' : 'transparent',
        color: selected ? '#fff' : 'var(--app-text-primary)',
        borderBottom: '1px solid var(--app-sidebar-border)',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: statusColor, flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 500 }}>{device.name}</div>
          <div style={{ fontSize: 11, color: selected ? 'rgba(255,255,255,0.7)' : 'var(--app-text-secondary)' }}>
            {device.machineId}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Task 4.2: DeviceList 组件

**Files:**
- Create: `src/components/sidebar/DeviceList.tsx`

```typescript
import DeviceCard from './DeviceCard';
import type { DeviceInfo } from '../../data/types/commands';

interface DeviceListProps {
  devices: DeviceInfo[];
  selectedId: string | null;
  onSelect: (device: DeviceInfo) => void;
}

export default function DeviceList({ devices, selectedId, onSelect }: DeviceListProps) {
  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      {devices.map((device) => (
        <DeviceCard
          key={device.machineId}
          device={device}
          selected={selectedId === device.machineId}
          onClick={() => onSelect(device)}
        />
      ))}
      {devices.length === 0 && (
        <div
          style={{
            padding: 24, textAlign: 'center',
            color: 'var(--app-text-hint)', fontSize: 13,
          }}
        >
          暂无设备
        </div>
      )}
    </div>
  );
}
```

---

### Task 4.3: AddDeviceButtons + Modal 占位

**Files:**
- Create: `src/components/sidebar/AddDeviceButtons.tsx`

```typescript
import { Button, Space } from 'antd';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';

interface AddDeviceButtonsProps {
  onAutoDiscover: () => void;
  onManualAdd: () => void;
}

export default function AddDeviceButtons({ onAutoDiscover, onManualAdd }: AddDeviceButtonsProps) {
  return (
    <div
      style={{
        display: 'flex', gap: 8, padding: 12,
        borderTop: '1px solid var(--app-sidebar-border)',
      }}
    >
      <Button
        icon={<SearchOutlined />}
        size="small"
        block
        onClick={onAutoDiscover}
      >
        自动发现
      </Button>
      <Button
        icon={<PlusOutlined />}
        size="small"
        block
        onClick={onManualAdd}
      >
        手动添加
      </Button>
    </div>
  );
}
```

---

## Phase 5: 控制栏 + 强乐观交互

### Task 5.1: OfflineBanner

**Files:**
- Create: `src/components/control/OfflineBanner.tsx`

```typescript
interface OfflineBannerProps {
  visible: boolean;
  machineId?: string;
}

export default function OfflineBanner({ visible, machineId }: OfflineBannerProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        margin: '0 16px 8px',
        padding: '8px 16px',
        background: 'var(--app-banner-bg)',
        border: '1px solid var(--app-banner-border)',
        borderRadius: 6,
        color: 'var(--app-banner-text)',
        fontSize: 13,
      }}
    >
      ⚠️ 设备 {machineId ? `[${machineId}]` : ''} 已离线，主控进程可能已崩溃或网络断开
    </div>
  );
}
```

---

### Task 5.2: Clock 动态时钟

**Files:**
- Create: `src/components/control/Clock.tsx`

```typescript
import { useState, useEffect } from 'react';

export default function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatted = time.toLocaleTimeString('zh-CN', { hour12: false });

  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, color: 'var(--app-text-secondary)' }}>
      {formatted}
    </span>
  );
}
```

---

### Task 5.3: ControlButtons 组件

**Files:**
- Create: `src/components/control/ControlButtons.tsx`

```typescript
import { Button, Space, Tooltip } from 'antd';
import type { ButtonDisabledMap } from '../../data/types/state';
import type { ButtonPhase, CommandResult } from '../../data/types/commands';
import type { RpcMethod } from '../../data/types/mqtt';

interface ControlButtonsProps {
  disabled: ButtonDisabledMap;
  phase: Record<string, ButtonPhase>;
  onCommand: (method: RpcMethod, label: string) => Promise<CommandResult | null>;
}

const BTN_COLLECTOR_OPEN = 'collector-open-device' as RpcMethod;
const BTN_COLLECTOR_CLOSE = 'collector-close-device' as RpcMethod;
const BTN_COLLECTOR_START = 'collector-start-ad' as RpcMethod;
const BTN_COLLECTOR_STOP = 'collector-stop-ad' as RpcMethod;
const BTN_LASER_CONNECT = 'laser-connect' as RpcMethod;
const BTN_LASER_DISCONNECT = 'laser-disconnect' as RpcMethod;
const BTN_LASER_ON = 'laser-on' as RpcMethod;
const BTN_LASER_OFF = 'laser-off' as RpcMethod;

function getPhaseStyle(phase: ButtonPhase | undefined): React.CSSProperties {
  switch (phase) {
    case 'sending': return { opacity: 0.6, cursor: 'wait' };
    case 'running': return { borderColor: '#52c41a', color: '#52c41a' };
    case 'error': return { borderColor: '#ff4d4f', color: '#ff4d4f' };
    default: return {};
  }
}

function getLabel(phase: ButtonPhase | undefined, defaultLabel: string): string {
  if (phase === 'sending') return '发送中...';
  if (phase === 'running') return defaultLabel.includes('开启') || defaultLabel.includes('开始')
    ? defaultLabel.replace('开启', '运行中').replace('开始', '运行中')
    : '已执行';
  return defaultLabel;
}

export default function ControlButtons({ disabled, phase, onCommand }: ControlButtonsProps) {
  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <Space size={8}>
        <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>采集卡:</span>
        <Button
          size="small"
          disabled={disabled.openCollector}
          style={getPhaseStyle(phase['openCollector'])}
          onClick={() => onCommand(BTN_COLLECTOR_OPEN, 'openCollector')}
        >
          {getLabel(phase['openCollector'], '打开设备')}
        </Button>
        <Button
          size="small"
          disabled={disabled.startAcquisition}
          style={getPhaseStyle(phase['startAcquisition'])}
          onClick={() => onCommand(BTN_COLLECTOR_START, 'startAcquisition')}
        >
          {getLabel(phase['startAcquisition'], '开始采集')}
        </Button>
        <Button
          size="small"
          disabled={disabled.stopAcquisition}
          onClick={() => onCommand(BTN_COLLECTOR_STOP, 'stopAcquisition')}
        >
          停止采集
        </Button>
        <Button
          size="small"
          disabled={disabled.closeCollector}
          onClick={() => onCommand(BTN_COLLECTOR_CLOSE, 'closeCollector')}
        >
          关闭设备
        </Button>
      </Space>

      <div style={{ width: 1, background: 'var(--app-card-border)' }} />

      <Space size={8}>
        <span style={{ fontSize: 12, color: 'var(--app-text-secondary)' }}>激光器:</span>
        <Button
          size="small"
          disabled={disabled.connectLaser}
          style={getPhaseStyle(phase['connectLaser'])}
          onClick={() => onCommand(BTN_LASER_CONNECT, 'connectLaser')}
        >
          {getLabel(phase['connectLaser'], '连接激光')}
        </Button>
        <Button
          size="small"
          disabled={disabled.laserOn}
          style={getPhaseStyle(phase['laserOn'])}
          onClick={() => onCommand(BTN_LASER_ON, 'laserOn')}
        >
          {getLabel(phase['laserOn'], '开启激光')}
        </Button>
        <Button
          size="small"
          disabled={disabled.laserOff}
          onClick={() => onCommand(BTN_LASER_OFF, 'laserOff')}
        >
          关闭激光
        </Button>
        <Button
          size="small"
          disabled={disabled.disconnectLaser}
          onClick={() => onCommand(BTN_LASER_DISCONNECT, 'disconnectLaser')}
        >
          断开激光
        </Button>
      </Space>
    </div>
  );
}
```

---

### Task 5.4: StatusIndicators 组件

**Files:**
- Create: `src/components/control/StatusIndicators.tsx`

```typescript
interface StatusIndicatorsProps {
  mqttStatus: 'online' | 'offline';
  collectorStatus: string;
  laserStatus: string;
}

export default function StatusIndicators({ mqttStatus, collectorStatus, laserStatus }: StatusIndicatorsProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
      <StatusDot
        color={mqttStatus === 'online' ? 'var(--app-status-online)' : 'var(--app-status-offline)'}
        label={`MQTT: ${mqttStatus === 'online' ? '已连接' : '未连接'}`}
      />
      <StatusDot
        color={collectorStatus === 'acquiring' ? 'var(--app-status-online)' : collectorStatus === 'idle' ? 'var(--app-text-hint)' : 'var(--app-status-offline)'}
        label={`采集: ${collectorStatus === 'acquiring' ? '采集中' : collectorStatus === 'idle' ? '就绪' : '---'}`}
      />
      <StatusDot
        color={laserStatus === 'emitting' ? 'var(--app-status-warning)' : laserStatus === 'idle' ? 'var(--app-text-hint)' : 'var(--app-status-offline)'}
        label={`激光: ${laserStatus === 'emitting' ? '发射中' : laserStatus === 'idle' ? '就绪' : '---'}`}
      />
    </div>
  );
}

function StatusDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </div>
  );
}
```

---

## Phase 6: 图表接入

### Task 6.1: WaveformChart (uPlot 命令式)

**Files:**
- Create: `src/components/charts/WaveformChart.tsx`

核心思路: uPlot 的 `data[0]` 是 x 轴 (点数 0..999), `data[1]`/`data[2]` 直接指向 RingBuffer 中的 Float64Array 切片。帧更新时替换 data[1]/data[2] → 调用 `u.setData(data)`。

```typescript
import { useRef, useEffect } from 'react';
import uPlot from 'uplot';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import type { RingBuffer } from '../../utils/ring-buffer';

interface WaveformChartProps {
  ch1Buffer: RingBuffer;
  ch2Buffer: RingBuffer;
}

export default function WaveformChart({ ch1Buffer, ch2Buffer }: WaveformChartProps) {
  const [containerRef, size] = useResizeObserver();
  const plotRef = useRef<uPlot | null>(null);
  const animRef = useRef<number>(0);
  const lastWriteIdx = useRef(-1);

  useEffect(() => {
    if (!containerRef.current || size.width === 0 || size.height === 0) return;

    const frameSize = ch1Buffer.getFrameSize();
    const xData = Array.from({ length: frameSize }, (_, i) => i);

    const opts: uPlot.Options = {
      width: size.width,
      height: size.height - 4,
      cursor: { show: false },
      select: { show: false },
      legend: { show: false },
      axes: [
        { show: false },
        { show: true, side: 1, stroke: '#888', grid: { stroke: 'rgba(128,128,128,0.15)' } },
      ],
      series: [
        {},
        { label: 'CH1', stroke: '#1890ff', width: 1 },
        { label: 'CH2', stroke: '#52c41a', width: 1 },
      ],
    };

    const data: uPlot.AlignedData = [
      xData,
      new Float64Array(frameSize),
      new Float64Array(frameSize),
    ];

    plotRef.current = new uPlot(opts, data, containerRef.current);

    // rAF 循环: 仅在环形缓冲区有新帧时更新
    const update = () => {
      const plot = plotRef.current;
      if (!plot) return;

      const currentIdx = ch1Buffer.getWriteIndex();
      if (currentIdx !== lastWriteIdx.current) {
        lastWriteIdx.current = currentIdx;
        const raw = ch1Buffer.getRawBuffer();
        const start = currentIdx * frameSize;
        const ch1Slice = raw.slice(start, start + frameSize);

        const raw2 = ch2Buffer.getRawBuffer();
        const ch2Slice = raw2.slice(start, start + frameSize);

        plot.data[1] = ch1Slice;
        plot.data[2] = ch2Slice;
        plot.setData(plot.data, false);
      }

      animRef.current = requestAnimationFrame(update);
    };

    animRef.current = requestAnimationFrame(update);

    return () => {
      cancelAnimationFrame(animRef.current);
      if (plotRef.current) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
    };
  }, [size]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        borderTop: '3px solid #1890ff',
        background: 'var(--app-card-bg)',
        borderRadius: 6,
        boxShadow: 'var(--app-card-shadow)',
        overflow: 'hidden',
        contain: 'layout style',
      }}
    />
  );
}
```

---

### Task 6.2: VisChart + Cn2Chart (时间序列)

**Files:**
- Create: `src/components/charts/VisChart.tsx`
- Create: `src/components/charts/Cn2Chart.tsx`

```typescript
// src/components/charts/VisChart.tsx
import { useRef, useEffect, useState } from 'react';
import uPlot from 'uplot';
import { useResizeObserver } from '../../hooks/useResizeObserver';
import { lowfreqStore } from '../../data/stores/lowfreq-store';
import type { LowFreqSample } from '../../data/types/commands';

const MAX_POINTS = 300;

export default function VisChart() {
  const [containerRef, size] = useResizeObserver();
  const plotRef = useRef<uPlot | null>(null);
  const dataRef = useRef<{ timestamps: number[]; values: (number | null)[] }>({
    timestamps: [0], values: [null],
  });
  // 用状态追踪最新点来触发 setData
  const [tick, setTick] = useState(0);

  useEffect(() => {
    return lowfreqStore.subscribe((sample: LowFreqSample) => {
      const d = dataRef.current;
      d.timestamps.push(sample.timestamp);
      d.values.push(sample.vis);
      if (d.timestamps.length > MAX_POINTS) {
        d.timestamps.shift();
        d.values.shift();
      }
      setTick((t) => t + 1);
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current || size.width === 0 || size.height === 0) return;

    if (plotRef.current) {
      plotRef.current.setData(
        [dataRef.current.timestamps, dataRef.current.values],
        false
      );
      return;
    }

    const opts: uPlot.Options = {
      width: size.width,
      height: size.height - 4,
      cursor: { show: false },
      select: { show: false },
      legend: { show: false },
      axes: [
        { show: true, stroke: '#888', grid: { stroke: 'rgba(128,128,128,0.15)' } },
        { show: true, side: 1, stroke: '#52c41a', grid: { stroke: 'rgba(128,128,128,0.15)' } },
      ],
      series: [
        {},
        { label: 'Vis', stroke: '#52c41a', width: 1.5, points: { show: false } },
      ],
    };

    plotRef.current = new uPlot(
      opts,
      [dataRef.current.timestamps, dataRef.current.values],
      containerRef.current
    );
  }, [size, tick]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        borderTop: '3px solid #52c41a',
        background: 'var(--app-card-bg)',
        borderRadius: 6,
        boxShadow: 'var(--app-card-shadow)',
        overflow: 'hidden',
        contain: 'layout style',
      }}
    />
  );
}
```

`Cn2Chart.tsx` 同理，差异仅为 `sample.cn2` 替代 `sample.vis`，边框色 `#722ed1`。

---

### Task 6.3: MultiParamCard (Empty 占位)

**Files:**
- Create: `src/components/charts/MultiParamCard.tsx`

```typescript
import { Card, Empty } from 'antd';

export default function MultiParamCard() {
  return (
    <Card
      title="📊 多参数六要素"
      size="small"
      style={{
        height: '100%',
        borderTop: '3px solid #faad14',
      }}
      styles={{
        body: {
          padding: 8,
          height: 'calc(100% - 38px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        },
      }}
    >
      <Empty description="六要素数据暂不可用" />
    </Card>
  );
}
```

---

## 集成：重构 ChartGrid 和 App.tsx (收尾任务)

各 Phase 完成后，需要更新现有占位组件以接入真实数据。

### 最终 App.tsx

```typescript
import { ConfigProvider, theme } from 'antd';
import { useState, useCallback, useRef } from 'react';
import AppLayout from './components/layout/AppLayout';
import { useMqttConnection } from './hooks/useMqttConnection';
import { useSystemState } from './hooks/useSystemState';
import { useRpcCommand } from './hooks/useRpcCommand';
import type { DeviceInfo } from './data/types/commands';

const MOCK_DEVICES: DeviceInfo[] = [
  { name: '测试节点A', machineId: 'daq-srv-01', brokerUrl: 'z0d131fe.ala.cn-hangzhou.emqxsl.cn', port: 8883, username: '001', password: '001', tls: true, status: 'unknown' },
];

export default function App() {
  const [devices] = useState<DeviceInfo[]>(MOCK_DEVICES);
  const [selectedDevice, setSelectedDevice] = useState<DeviceInfo | null>(null);
  const { connected, willTriggered, connect, disconnect, rpcManager } = useMqttConnection();
  const { systemState, buttonDisabled, setOffline } = useSystemState();
  const { phase, send } = useRpcCommand(rpcManager);

  const handleSelectDevice = useCallback((device: DeviceInfo) => {
    setSelectedDevice(device);
    connect({
      brokerUrl: device.brokerUrl,
      username: device.username,
      password: device.password,
      machineId: device.machineId,
      port: device.port,
    });
  }, [connect]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1890ff' } }}>
      <AppLayout
        devices={devices}
        selectedDevice={selectedDevice}
        onSelectDevice={handleSelectDevice}
        connected={connected}
        willTriggered={willTriggered || false}
        systemState={systemState}
        buttonDisabled={buttonDisabled}
        rpcPhase={phase}
        onRpcCommand={send}
      />
    </ConfigProvider>
  );
}
```

---

## 验证清单

- [ ] `npm run dev` 启动无编译错误
- [ ] 布局: 100vh 无外层滚动条，Navbar 48px, Sidebar 250px
- [ ] 主题切换: dark-theme class toggle 正常
- [ ] 设备选择: 点击设备卡片触发 MQTT connect → 订阅主题 → SYSTEM_STATE RPC
- [ ] 控制按钮: 过渡态 → 乐观更新 / 超时回退
- [ ] will 消息: 横幅 + 全按钮禁用
- [ ] 波形图表: rAF 更新无 React render
- [ ] 低频图表: 7s 更新触发 setState in leaf component

---

*计划日期: 2026-05-27*
