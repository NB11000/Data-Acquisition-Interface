import { useEffect, useRef } from 'react';
import { getPool } from '../mqtt/pool';
import { useDeviceStore } from '../stores/deviceStore';
import { useCollectorStore } from '../stores/collectorStore';
import { useServerStore } from '../stores/serverStore';
import { MQTT_MODE } from '../env';
import type { MqttClientLike } from '../mqtt/mqttClientLike';
import { startMockWaveform } from '../mock/mockWaveform';
import { startMockLowFreq } from '../mock/mockLowFreq';

const sysInjectedRef: { current: Set<string> } = { current: new Set() };

function injectMockSysConnected(client: MqttClientLike, deviceId: string): void {
  const sysTopic = `$SYS/brokers/emqx/clients/${deviceId}/connected`;
  const sysPayload = new TextEncoder().encode(JSON.stringify({
    connected: true,
    clientid: deviceId,
  }));
  client.injectMessage(sysTopic, sysPayload);
}

/** Mock 模式专用 Hook：$SYS 注入 + 波形/低频生成器 */
export function useMockGenerators(): void {
  if (MQTT_MODE !== 'mock') return;

  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const deviceOpened = useCollectorStore((s) => s.deviceOpened);

  // ── 连接建立时注入 $SYS 使设备显示在线 ──
  useEffect(() => {
    const pool = getPool();
    const servers = useServerStore.getState().servers;

    const onStateChange = ({ serverId, state }: { serverId: string; state: string }) => {
      if (state !== 'connected') return;
      const client = pool.getClient(serverId);
      if (!client?.isConnected) return;
      const allDevices = useDeviceStore.getState().devices;
      for (const d of allDevices) {
        if (!sysInjectedRef.current.has(d.id)) {
          sysInjectedRef.current.add(d.id);
          injectMockSysConnected(client, d.id);
        }
      }
    };

    pool.onStateChange(onStateChange);

    // 初始已连接的服务器也注入
    for (const server of servers) {
      const client = pool.getClient(server.id);
      if (client?.isConnected) {
        const allDevices = useDeviceStore.getState().devices;
        for (const d of allDevices) {
          if (!sysInjectedRef.current.has(d.id)) {
            sysInjectedRef.current.add(d.id);
            injectMockSysConnected(client, d.id);
          }
        }
      }
    }

    return () => {
      pool.offStateChange(onStateChange);
    };
  }, []);

  // ── 新添加设备注入 $SYS ──
  useEffect(() => {
    const pool = getPool();
    for (const d of devices) {
      if (sysInjectedRef.current.has(d.id)) continue;
      sysInjectedRef.current.add(d.id);
      const server = useServerStore.getState().servers.find((s) => s.id === d.serverId);
      if (!server) continue;
      const client = pool.getClient(server.id);
      if (!client || !client.isConnected) continue;
      injectMockSysConnected(client, d.id);
    }
  }, [devices]);

  // ── 波形/低频生成器（由采集状态驱动） ──
  const stopWaveformRef = useRef<(() => void) | null>(null);
  const stopLowFreqRef = useRef<(() => void) | null>(null);

  useEffect(() => {
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

    stopWaveformRef.current = startMockWaveform(client, selectedId);
    stopLowFreqRef.current = startMockLowFreq(client, selectedId);

    return () => {
      stopWaveformRef.current?.();
      stopLowFreqRef.current?.();
    };
  }, [selectedId, deviceOpened, acquiring]);
}
