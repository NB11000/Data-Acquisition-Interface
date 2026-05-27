import type { MqttClientLike } from './client';
import type { MockMqttClient } from '../mock/mockMqttClient';
import { parseWaveformBinary } from '../utils/binary';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useMqttStore } from '../stores/mqttStore';
import { useAlarmStore } from '../stores/alarmStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import type { StateChangedEvent, WillMessage, DeviceAlarm, LowFreqSample } from './types';

export function setupMqttRouter(client: MqttClientLike): void {
  (client as MockMqttClient).onMessage = (topic: string, payload: Uint8Array) => {
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
