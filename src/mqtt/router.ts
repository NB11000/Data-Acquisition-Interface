import type { ConnectionPool } from './connectionPool';
import type { MqttClientLike } from './client';
import { tryResolveRpc, clearPendingRpcs } from './rpc';
import { parseWaveformBinary } from '../utils/binary';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import { useAlarmStore } from '../stores/alarmStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import { useDeviceStore } from '../stores/deviceStore';
import type { StateChangedEvent, WillMessage, DeviceAlarm, LowFreqSample, SysClientEvent } from './types';

// ── Issue 3: 多连接 Router ──

// $SYS 事件回调（供外部注册）
let _onSysConnected: ((serverId: string, clientId: string, connected: boolean) => void) | null = null;
let _onSysDisconnected: ((serverId: string, clientId: string, connected: boolean) => void) | null = null;

export function onSysConnected(cb: (serverId: string, clientId: string, connected: boolean) => void): void {
  _onSysConnected = cb;
}

export function onSysDisconnected(cb: (serverId: string, clientId: string, connected: boolean) => void): void {
  _onSysDisconnected = cb;
}

/** 多连接版 Router：注册到 ConnectionPool 的 onMessage。返回清理函数。 */
export function setupRouter(pool: ConnectionPool): () => void {
  const stateListener = ({ serverId, state }: { serverId: string; state: string }) => {
    if (state === 'reconnecting' || state === 'disconnected' || state === 'failed') {
      clearPendingRpcs();
    }
  };
  pool.onStateChange(stateListener);

  const messageListener = ({ serverId, topic, payload }: { serverId: string; topic: string; payload: Uint8Array }) => {
    // 0) $SYS broker 事件 — 设备在线状态
    if (topic.startsWith('$SYS/brokers/')) {
      const parts = topic.split('/');
      // topic 格式: $SYS/brokers/{node}/clients/{clientId}/connected|disconnected
      const clientId = parts[4];
      const isConnected = parts[5] === 'connected';

      // 更新 connectionPool 的在线客户端缓存
      if (isConnected) {
        pool.addOnlineClient(serverId, clientId);
      } else {
        pool.removeOnlineClient(serverId, clientId);
      }

      // 按 serverId + clientId 查 deviceStore 匹配设备
      const deviceState = useDeviceStore.getState();
      const matchedDevice = deviceState.devices.find(
        (d) => d.id === clientId && d.serverId === serverId,
      );

      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as SysClientEvent;
        const online = event.connected ?? isConnected;
        if (matchedDevice) {
          deviceState.setOnline(matchedDevice.id, online);
        }
        if (isConnected && _onSysConnected) {
          _onSysConnected(serverId, clientId, true);
        } else if (_onSysDisconnected) {
          _onSysDisconnected(serverId, clientId, false);
        }
      } catch {
        if (matchedDevice) {
          deviceState.setOnline(matchedDevice.id, isConnected);
        }
        if (isConnected && _onSysConnected) {
          _onSysConnected(serverId, clientId, true);
        } else if (_onSysDisconnected) {
          _onSysDisconnected(serverId, clientId, false);
        }
      }
      return;
    }

    // 1) RPC 响应优先拦截
    if (tryResolveRpc(topic, payload)) return;

    // 2) Domain 主题分发（顺序: state_changed → will → alarm → waveform → lowfreq）
    if (topic.includes('/events/state_changed')) {
      const event = JSON.parse(new TextDecoder().decode(payload)) as StateChangedEvent;
      if (event.state?.collector) {
        useCollectorStore.getState().applyState(event.state.collector);
      }
      if (event.state?.laser) {
        useLaserStore.getState().applyState(event.state.laser);
      }
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
    } else if (topic.includes('/waveform/ch1')) {
      const data = parseWaveformBinary(payload.buffer as ArrayBuffer);
      useWaveformStore.getState().appendCh1(data, Date.now());
    } else if (topic.includes('/waveform/ch2')) {
      const data = parseWaveformBinary(payload.buffer as ArrayBuffer);
      useWaveformStore.getState().appendCh2(data, Date.now());
    } else if (topic.includes('/lowfreq')) {
      const sample = JSON.parse(new TextDecoder().decode(payload)) as LowFreqSample;
      useDataStore.getState().append(sample);
    }
  };
  pool.onMessage(messageListener);

  return () => {
    pool.offStateChange(stateListener);
    pool.offMessage(messageListener);
  };
}

// ── 向后兼容：原单连接版本（标记 @deprecated） ──

/** @deprecated 使用 setupRouter(pool) 替代 */
export function setupMqttRouter(client: MqttClientLike): void {
  client.onMessage = (topic: string, payload: Uint8Array) => {
    if (topic.startsWith('$SYS/brokers/')) {
      const parts = topic.split('/');
      const clientId = parts[4];
      const isConnected = parts[5] === 'connected';
      try {
        const event = JSON.parse(new TextDecoder().decode(payload)) as SysClientEvent;
        useDeviceStore.getState().setOnline(clientId, event.connected ?? isConnected);
      } catch {
        useDeviceStore.getState().setOnline(clientId, isConnected);
      }
      return;
    }

    if (tryResolveRpc(topic, payload)) return;

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
    }
  };
}
