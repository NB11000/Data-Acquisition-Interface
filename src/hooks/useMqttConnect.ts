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
  sysClientConnectedTopic,
  sysClientDisconnectedTopic,
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

function injectMockSysConnected(client: MockMqttClient, deviceId: string): void {
  const sysTopic = `$SYS/brokers/emqx/clients/${deviceId}/connected`;
  const sysPayload = new TextEncoder().encode(JSON.stringify({
    connected: true,
    clientid: deviceId,
  }));
  client.injectMessage(sysTopic, sysPayload);
}

// ── Hook ──

export function useMqttConnect(): void {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const mqttConnected = useMqttStore((s) => s.mqttConnected);

  // Collector state — drives mock generator start/stop
  const acquiring = useCollectorStore((s) => s.acquiring);
  const deviceOpened = useCollectorStore((s) => s.deviceOpened);

  // Tracks which device we are currently subscribed to
  const subscribedDeviceRef = useRef<string | null>(null);
  // Mock generator stop handles
  const stopWaveformRef = useRef<(() => void) | null>(null);
  const stopLowFreqRef = useRef<(() => void) | null>(null);
  // Tracks which device IDs already received mock $SYS injection
  const sysInjectedRef = useRef<Set<string>>(new Set());

  // ── Issue 4: Init the MQTT client once (survives StrictMode remount) ──
  useEffect(() => {
    const existing = getMqttClientSafely();
    const client = existing ?? initMqttClient('ui-client');

    client.onConnect = () => {
      useMqttStore.getState().setConnected(true);

      // Q3: In mock mode, inject $SYS connected for all already-added devices
      if (MQTT_MODE === 'mock') {
        const mockClient = client as unknown as MockMqttClient;
        const allDevices = useDeviceStore.getState().devices;
        for (const d of allDevices) {
          if (!sysInjectedRef.current.has(d.id)) {
            sysInjectedRef.current.add(d.id);
            injectMockSysConnected(mockClient, d.id);
          }
        }
      }
    };

    client.onDisconnect = () => {
      useMqttStore.getState().setConnected(false);
      clearPendingRpcs();
      // Q1: Stop generators on disconnect
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
      stopWaveformRef.current = null;
      stopLowFreqRef.current = null;
    };

    // Issue 11: single onMessage handler is set by router (includes RPC resolution)
    setupMqttRouter(client);

    // Subscribe to EMQX $SYS topics for device online status
    client.subscribe(sysClientConnectedTopic());
    client.subscribe(sysClientDisconnectedTopic());

    client.connect();

    return () => {
      // Issue 4: do NOT destroy the MQTT client – let it survive StrictMode remounts
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
    };
  }, []);

  // ── Q3: Inject mock $SYS for newly added devices ──
  useEffect(() => {
    if (MQTT_MODE !== 'mock' || !mqttConnected) return;
    const client = getMqttClientSafely();
    if (!client) return;
    const mockClient = client as unknown as MockMqttClient;
    for (const d of devices) {
      if (!sysInjectedRef.current.has(d.id)) {
        sysInjectedRef.current.add(d.id);
        injectMockSysConnected(mockClient, d.id);
      }
    }
  }, [devices, mqttConnected]);

  // ── Issue 3: React to connection / device changes ──
  useEffect(() => {
    if (!mqttConnected || !selectedId) {
      return;
    }

    const client = getMqttClient();
    const prevId = subscribedDeviceRef.current;

    // Device switch → unsubscribe old
    if (prevId && prevId !== selectedId) {
      unsubscribeDevice(client, prevId);
      // Q1: Stop generators on device switch (will be restarted if state allows)
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
      stopWaveformRef.current = null;
      stopLowFreqRef.current = null;
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
            // Q3: Mock mode — inject $SYS for selected device (covers edge cases)
            if (MQTT_MODE === 'mock') {
              const mockClient = client as unknown as MockMqttClient;
              if (!sysInjectedRef.current.has(selectedId)) {
                sysInjectedRef.current.add(selectedId);
                injectMockSysConnected(mockClient, selectedId);
              }
            }
          }
        })
        .catch(() => {});

      useCollectorStore.getState().reset();
      useLaserStore.getState().reset();
      useWaveformStore.getState().clear();
      useDataStore.getState().clear();
    }

    subscribedDeviceRef.current = selectedId;
  }, [mqttConnected, selectedId]);

  // ── Q1: Mock generator lifecycle driven by collector state ──
  useEffect(() => {
    if (MQTT_MODE !== 'mock') return;

    if (!mqttConnected || !selectedId || !deviceOpened || !acquiring) {
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
      stopWaveformRef.current = null;
      stopLowFreqRef.current = null;
      return;
    }

    const client = getMqttClientSafely();
    if (!client) return;

    const mockClient = client as unknown as MockMqttClient;
    stopWaveformRef.current?.();
    stopLowFreqRef.current?.();
    stopWaveformRef.current = startMockWaveform(mockClient, selectedId);
    stopLowFreqRef.current = startMockLowFreq(mockClient, selectedId);
  }, [mqttConnected, selectedId, deviceOpened, acquiring]);
}
