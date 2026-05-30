import { useEffect, useRef } from 'react';
import { getPool } from '../mqtt/pool';
import { setupRouter } from '../mqtt/router';
import { sendRpcCommand, clearPendingRpcs } from '../mqtt/rpc';
import { useMqttStore } from '../stores/mqttStore';
import { useDeviceStore } from '../stores/deviceStore';
import { useCollectorStore } from '../stores/collectorStore';
import { useLaserStore } from '../stores/laserStore';
import { useWaveformStore } from '../stores/waveformStore';
import { useDataStore } from '../stores/dataStore';
import { useAlarmStore } from '../stores/alarmStore';
import { useServerStore, type PoolConnectionState as ConnectionState } from '../stores/serverStore';
import { MQTT_MODE } from '../env';
import type { MockMqttClient as MockClient } from '../mock/mockMqttClient';
import { startMockWaveform } from '../mock/mockWaveform';
import { startMockLowFreq } from '../mock/mockLowFreq';

function injectMockSysConnected(mockClient: MockClient, deviceId: string): void {
  const sysTopic = `$SYS/brokers/emqx/clients/${deviceId}/connected`;
  const sysPayload = new TextEncoder().encode(JSON.stringify({
    connected: true,
    clientid: deviceId,
  }));
  mockClient.injectMessage(sysTopic, sysPayload);
}

export function useMqttConnect(): void {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const deviceOpened = useCollectorStore((s) => s.deviceOpened);

  const prevSelectedRef = useRef<string | null>(null);
  const stopWaveformRef = useRef<(() => void) | null>(null);
  const stopLowFreqRef = useRef<(() => void) | null>(null);
  const sysInjectedRef = useRef<Set<string>>(new Set());

  // ── 初始化：为所有 server 创建连接，注册 router ──
  useEffect(() => {
    const pool = getPool();
    const servers = useServerStore.getState().servers;

    // 注册 router（须在 create 前完成，确保 onStateChange 监听已就位）
    setupRouter(pool);

    // 连接状态 → store 同步
    const onStateChange = ({ serverId, state }: { serverId: string; state: string }) => {
      useServerStore.getState().setConnected(serverId, state === 'connected');
      useServerStore.getState().setConnectionState(serverId, state as ConnectionState);

      const anyConnected = useServerStore.getState().servers.some(
        (s) => pool.isConnected(s.id),
      );
      useMqttStore.getState().setConnected(anyConnected);

      if (state === 'disconnected' || state === 'failed') {
        clearPendingRpcs();
      }

      // Mock 模式：注入 $SYS 使设备显示在线
      if (MQTT_MODE === 'mock' && state === 'connected') {
        const client = pool.getClient(serverId) as unknown as MockClient;
        const allDevices = useDeviceStore.getState().devices;
        for (const d of allDevices) {
          if (!sysInjectedRef.current.has(d.id)) {
            sysInjectedRef.current.add(d.id);
            injectMockSysConnected(client, d.id);
          }
        }
      }
    };

    pool.onStateChange(onStateChange);

    // 并行创建所有 server 连接
    for (const server of servers) {
      if (!pool.getClient(server.id)) {
        pool.create(server);
      }
    }

    // 为当前已选设备订阅主题
    const currentId = useDeviceStore.getState().selectedId;
    if (currentId) {
      const device = useDeviceStore.getState().devices.find((d) => d.id === currentId);
      if (device) {
        pool.subscribeDevice(device.serverId, currentId);
        pool.switchFollowing(device.serverId, null, currentId);
        sendRpcCommand(pool, currentId, 'SYSTEM_STATE')
          .then((result) => {
            if (result.state) {
              useCollectorStore.getState().applyState(result.state.collector);
              useLaserStore.getState().applyState(result.state.laser);
            }
          })
          .catch(() => {});
      }
      prevSelectedRef.current = currentId;
    }

    return () => {
      pool.offStateChange(onStateChange);
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 新添加设备注入 Mock $SYS ──
  useEffect(() => {
    if (MQTT_MODE !== 'mock') return;
    const pool = getPool();
    for (const d of devices) {
      if (sysInjectedRef.current.has(d.id)) continue;
      sysInjectedRef.current.add(d.id);
      const server = useServerStore.getState().servers.find((s) => s.id === d.serverId);
      if (!server) continue;
      const client = pool.getClient(server.id);
      if (!client || !client.isConnected) continue;
      injectMockSysConnected(client as unknown as MockClient, d.id);
    }
  }, [devices]);

  // ── 设备切换：管理常驻主题 + 跟随主题 ──
  useEffect(() => {
    if (!selectedId) return;

    const pool = getPool();
    const prevId = prevSelectedRef.current;

    if (prevId === selectedId) return;

    const device = useDeviceStore.getState().devices.find((d) => d.id === selectedId);
    if (!device) return;

    const prevDevice = prevId
      ? useDeviceStore.getState().devices.find((d) => d.id === prevId)
      : null;

    if (prevDevice && prevDevice.serverId === device.serverId) {
      // 同服务器 → 复用连接，切换主题
      pool.subscribeDevice(device.serverId, selectedId);
      pool.switchFollowing(device.serverId, prevDevice.id, selectedId);
      pool.unsubscribeDevice(device.serverId, prevDevice.id, true);
    } else {
      // 跨服务器 / 首次选择
      if (prevDevice) {
        pool.switchFollowing(prevDevice.serverId, prevDevice.id, null);
        pool.unsubscribeDevice(prevDevice.serverId, prevDevice.id, true);
      }
      pool.subscribeDevice(device.serverId, selectedId);
      pool.switchFollowing(device.serverId, null, selectedId);
    }

    // 请求设备状态
    sendRpcCommand(pool, selectedId, 'SYSTEM_STATE')
      .then((result) => {
        if (result.state) {
          useCollectorStore.getState().applyState(result.state.collector);
          useLaserStore.getState().applyState(result.state.laser);
        }
      })
      .catch(() => {});

    // 清空数据 stores
    useCollectorStore.getState().reset();
    useLaserStore.getState().reset();
    useWaveformStore.getState().clear();
    useDataStore.getState().clear();
    useAlarmStore.getState().clear();

    prevSelectedRef.current = selectedId;
  }, [selectedId]);

  // ── Mock 波形/低频生成器（由采集状态驱动） ──
  useEffect(() => {
    if (MQTT_MODE !== 'mock') return;

    stopWaveformRef.current?.();
    stopLowFreqRef.current?.();
    stopWaveformRef.current = null;
    stopLowFreqRef.current = null;

    if (!selectedId || !deviceOpened || !acquiring) return;

    const pool = getPool();
    const device = useDeviceStore.getState().devices.find((d) => d.id === selectedId);
    if (!device) return;

    const client = pool.getClient(device.serverId);
    if (!client || !client.isConnected) return;

    const mockClient = client as unknown as MockClient;
    stopWaveformRef.current = startMockWaveform(mockClient, selectedId);
    stopLowFreqRef.current = startMockLowFreq(mockClient, selectedId);
  }, [selectedId, deviceOpened, acquiring]);
}
