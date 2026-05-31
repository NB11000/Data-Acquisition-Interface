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
import { useMockGenerators } from './useMockGenerators';

export function useMqttConnect(): void {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const prevSelectedRef = useRef<string | null>(null);

  // Mock 模式：启动 $SYS 注入 + 波形/低频生成器
  useMockGenerators();

  // ── 初始化：为所有 server 创建连接，注册 router ──
  useEffect(() => {
    const pool = getPool();
    const servers = useServerStore.getState().servers;

    // 注册 router（返回清理函数，解决 StrictMode 双挂载导致监听器重复注册问题）
    const teardownRouter = setupRouter(pool);

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
      teardownRouter();
      pool.offStateChange(onStateChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

    // 先清空数据 stores，避免残留旧数据被新设备渲染
    useCollectorStore.getState().reset();
    useLaserStore.getState().reset();
    useWaveformStore.getState().clear();
    useDataStore.getState().clear();
    useAlarmStore.getState().clear();

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

    prevSelectedRef.current = selectedId;
  }, [selectedId]);
}
