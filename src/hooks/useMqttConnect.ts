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
    setupRpcListener(client, '');

    client.connect();
    if (MQTT_MODE === 'mock') {
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
