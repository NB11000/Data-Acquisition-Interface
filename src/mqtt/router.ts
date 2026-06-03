import type { ConnectionPool } from './connectionPool';
import { tryResolveRpc, clearPendingRpcs } from './rpc';
import { parseWaveformBinary } from '../utils/binary';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import { useAlarmStore } from '../stores/alarmStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import { useDeviceStore } from '../stores/deviceStore';
import type { StateChangedEvent, DeviceAlarm, LowFreqSample, DeviceStatusPayload } from './types';

function extractMachineId(topic: string): string {
  const match = topic.match(/^daq\/(.+)\/events\/will$/);
  return match ? match[1] : '';
}

export function setupRouter(pool: ConnectionPool): () => void {
  const stateListener = ({ serverId, state }: { serverId: string; state: string }) => {
    if (state === 'reconnecting' || state === 'disconnected' || state === 'failed') {
      clearPendingRpcs(serverId);
    }
  };
  pool.onStateChange(stateListener);

  const messageListener = ({ serverId, topic, payload }: { serverId: string; topic: string; payload: Uint8Array }) => {
    if (tryResolveRpc(topic, payload)) return;

    if (topic.endsWith('/events/will')) {
      const machineId = extractMachineId(topic);
      if (!machineId) return;
      try {
        const data: DeviceStatusPayload = JSON.parse(new TextDecoder().decode(payload));
        const deviceState = useDeviceStore.getState();
        const device = deviceState.devices.find(d => d.id === machineId);
        if (!device) return;

        if (data.status === 'online') {
          if (device.lastTs !== undefined && data.ts <= device.lastTs) return;
          deviceState.setOnline(machineId, true, 'device_online');
          pool.addOnlineClient(serverId, machineId);
          const mqttState = useMqttStore.getState();
          if (mqttState.willReceived && mqttState.willDeviceId === machineId) {
            mqttState.clearWill();
          }
          return;
        }

        if (data.eventType === 'device_offline') {
          if (device.lastTs !== undefined && data.ts <= device.lastTs) return;
          deviceState.setOnline(machineId, false, 'device_offline');
          pool.removeOnlineClient(serverId, machineId);
          return;
        }

        if (data.eventType === 'process_crashed') {
          if (device.lastEventType === 'process_crashed') return;
          deviceState.setOnline(machineId, false, 'process_crashed');
          useMqttStore.getState().setWill(machineId);
          pool.removeOnlineClient(serverId, machineId);
          return;
        }
      } catch { /* JSON 解析失败，忽略 */ }
      return;
    }

    if (topic.includes('/events/state_changed')) {
      try {
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
      } catch { /* 解析失败，静默跳过 */ }
    } else if (topic.includes('/events/device_alarm')) {
      try {
        const alarm = JSON.parse(new TextDecoder().decode(payload)) as DeviceAlarm;
        useAlarmStore.getState().add(alarm);
      } catch { /* 解析失败，静默跳过 */ }
    } else if (topic.includes('/waveform/ch1')) {
      const data = parseWaveformBinary(payload.buffer);
      useWaveformStore.getState().appendCh1(data, Date.now());
    } else if (topic.includes('/waveform/ch2')) {
      const data = parseWaveformBinary(payload.buffer);
      useWaveformStore.getState().appendCh2(data, Date.now());
    } else if (topic.includes('/lowfreq')) {
      try {
        const sample = JSON.parse(new TextDecoder().decode(payload)) as LowFreqSample;
        useDataStore.getState().append(sample);
      } catch { /* 解析失败，静默跳过 */ }
    }
  };
  pool.onMessage(messageListener);

  return () => {
    pool.offStateChange(stateListener);
    pool.offMessage(messageListener);
  };
}
