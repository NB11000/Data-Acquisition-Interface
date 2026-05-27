import { useEffect, useRef } from 'react';
import { getMqttClient, getMqttClientSafely, initMqttClient } from '../mqtt/client';
import { setupMqttRouter } from '../mqtt/router';
import { sendRpcCommand, clearPendingRpcs } from '../mqtt/rpc';
import { useMqttStore } from '../stores/mqttStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import { MQTT_MODE } from '../env';
import type { MqttClientLike } from '../mqtt/client';
import type { MockMqttClient } from '../mock/mockMqttClient';

// Moved here from mqtt/topics to avoid cross-import gymnastics
import {
  waveformCh1Topic,
  waveformCh2Topic,
  stateChangedTopic,
  willTopic,
  deviceAlarmTopic,
  lowFreqTopic,
  rpcResponsePattern,
} from '../mqtt/topics';
import { startMockWaveform } from '../mock/mockWaveform';
import { startMockLowFreq } from '../mock/mockLowFreq';

// ── Helpers ──

function subscribeDevice(client: MqttClientLike, machineId: string): void {
  client.subscribe(waveformCh1Topic(machineId));
  client.subscribe(waveformCh2Topic(machineId));
  client.subscribe(stateChangedTopic(machineId));
  client.subscribe(willTopic(machineId));
  client.subscribe(deviceAlarmTopic(machineId));
  client.subscribe(lowFreqTopic(machineId));
  client.subscribe(rpcResponsePattern(machineId));
}

function unsubscribeDevice(client: MqttClientLike, machineId: string): void {
  client.unsubscribe(`daq/${machineId}/#`);
  client.unsubscribe(`$rpc/${machineId}/#`);
}

// ── Hook ──

export function useMqttConnect(): void {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const mqttConnected = useMqttStore((s) => s.mqttConnected);

  // Tracks which device we are currently subscribed to
  const subscribedDeviceRef = useRef<string | null>(null);
  // Mock generator stop handles
  const stopWaveformRef = useRef<(() => void) | null>(null);
  const stopLowFreqRef = useRef<(() => void) | null>(null);

  // ── Issue 4: Init the MQTT client once (survives StrictMode remount) ──
  useEffect(() => {
    const existing = getMqttClientSafely();
    const client = existing ?? initMqttClient('ui-client');

    client.onConnect = () => {
      useMqttStore.getState().setConnected(true);
    };

    client.onDisconnect = () => {
      useMqttStore.getState().setConnected(false);
      clearPendingRpcs();
    };

    // Issue 11: single onMessage handler is set by router (includes RPC resolution)
    setupMqttRouter(client);

    client.connect();

    return () => {
      // Issue 4: do NOT destroy the MQTT client – let it survive StrictMode remounts
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
    };
  }, []);

  // ── Issue 3: React to connection / device changes ──
  useEffect(() => {
    if (!mqttConnected || !selectedId) {
      // Connection lost → stop generators
      if (!mqttConnected) {
        stopWaveformRef.current?.();
        stopLowFreqRef.current?.();
        stopWaveformRef.current = null;
        stopLowFreqRef.current = null;
      }
      return;
    }

    const client = getMqttClient();
    const prevId = subscribedDeviceRef.current;

    // Device switch → unsubscribe old
    if (prevId && prevId !== selectedId) {
      unsubscribeDevice(client, prevId);
    }

    // (Re-)subscribe current device (idempotent – safe to call multiple times)
    subscribeDevice(client, selectedId);

    // Only send SYSTEM_STATE + clear stores on initial selection or device switch
    if (prevId !== selectedId) {
      sendRpcCommand(client, selectedId, 'SYSTEM_STATE')
        .then((result) => {
          if (result.state) {
            useCollectorStore.getState().applyState(result.state.collector);
            useLaserStore.getState().applyState(result.state.laser);
          }
        })
        .catch(() => {});

      useWaveformStore.getState().clear();
      useDataStore.getState().clear();
    }

    subscribedDeviceRef.current = selectedId;

    // Start / restart mock generators
    if (MQTT_MODE === 'mock') {
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
      const mockClient = client as unknown as MockMqttClient;
      stopWaveformRef.current = startMockWaveform(mockClient, selectedId);
      stopLowFreqRef.current = startMockLowFreq(mockClient, selectedId);
    }
  }, [mqttConnected, selectedId]);
}
