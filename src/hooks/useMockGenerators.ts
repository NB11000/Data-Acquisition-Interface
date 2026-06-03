import { useEffect, useRef } from 'react';
import { getPool } from '../mqtt/pool';
import { useDeviceStore } from '../stores/deviceStore';
import { useCollectorStore } from '../stores/collectorStore';
import { useServerStore } from '../stores/serverStore';
import { MQTT_MODE } from '../env';
import type { MqttClientLike } from '../mqtt/mqttClientLike';
import type { DeviceStatusPayload } from '../mqtt/types';
import { startMockWaveform } from '../mock/mockWaveform';
import { startMockLowFreq } from '../mock/mockLowFreq';

function injectMockDeviceOnline(client: MqttClientLike, deviceId: string): void {
  const topic = `daq/${deviceId}/events/will`;
  const now = Date.now();
  const payload: DeviceStatusPayload = {
    status: "online",
    ts: now,
    eventType: "device_online",
    source: "device",
    message: "设备已上线",
    timestamp: new Date().toISOString(),
  };
  client.injectMessage(topic, new TextEncoder().encode(JSON.stringify(payload)));
}

/** Mock 模式专用 Hook：上线注入 + 波形/低频生成器 */
export function useMockGenerators(): void {
  if (MQTT_MODE !== 'mock') return;

  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const deviceOpened = useCollectorStore((s) => s.deviceOpened);
  const willInjectedRef = useRef(new Set<string>());

  // ── 连接建立时注入 events/will 使设备显示在线 ──
  useEffect(() => {
    const pool = getPool();
    const servers = useServerStore.getState().servers;

    const onStateChange = ({ serverId, state }: { serverId: string; state: string }) => {
      if (state !== 'connected') {
        const allDevices = useDeviceStore.getState().devices;
        for (const d of allDevices) {
          if (d.serverId === serverId) {
            willInjectedRef.current.delete(d.id);
          }
        }
        return;
      }
      const client = pool.getClient(serverId);
      if (!client?.isConnected) return;
      const allDevices = useDeviceStore.getState().devices;
      for (const d of allDevices) {
        if (!willInjectedRef.current.has(d.id)) {
          willInjectedRef.current.add(d.id);
          injectMockDeviceOnline(client, d.id);
        }
      }
    };

    pool.onStateChange(onStateChange);

    for (const server of servers) {
      const client = pool.getClient(server.id);
      if (client?.isConnected) {
        const allDevices = useDeviceStore.getState().devices;
        for (const d of allDevices) {
          if (!willInjectedRef.current.has(d.id)) {
            willInjectedRef.current.add(d.id);
            injectMockDeviceOnline(client, d.id);
          }
        }
      }
    }

    return () => {
      pool.offStateChange(onStateChange);
    };
  }, []);

  // ── 新添加设备注入 events/will ──
  useEffect(() => {
    const pool = getPool();
    for (const d of devices) {
      if (willInjectedRef.current.has(d.id)) continue;
      willInjectedRef.current.add(d.id);
      const server = useServerStore.getState().servers.find((s) => s.id === d.serverId);
      if (!server) continue;
      const client = pool.getClient(server.id);
      if (!client || !client.isConnected) continue;
      injectMockDeviceOnline(client, d.id);
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
