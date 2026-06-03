import { useEffect, useRef } from 'react';
import type { ConnectionPool } from '../mqtt/connectionPool';
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

/** 发送 system-state RPC，失败 3 秒后重试一次 */
function sendStateRpcWithRetry(pool: ConnectionPool, machineId: string) {
  let retried = false;
  const retryTimerRef: { current: ReturnType<typeof setTimeout> | null } = { current: null };

  const handleResult = (result: Record<string, unknown>) => {
    const state = result.state ?? result;
    if (state && typeof state === 'object') {
      const s = state as Record<string, unknown>;
      if (s.collector) useCollectorStore.getState().applyState(s.collector as never);
      if (s.laser) useLaserStore.getState().applyState(s.laser as never);
    }
  };

  const doSend = () => {
    sendRpcCommand(pool, machineId, 'system-state')
      .then((result) => {
        console.log('[system-state RPC 成功]', machineId, result);
        handleResult(result as unknown as Record<string, unknown>);
      })
      .catch((err) => {
        console.warn('[system-state RPC 失败]', machineId, (err as Error).message);
        if (!retried) {
          retried = true;
          console.warn('[system-state RPC 3s 后重试]', machineId);
          retryTimerRef.current = setTimeout(() => {
            sendRpcCommand(pool, machineId, 'system-state')
              .then((result) => {
                handleResult(result as unknown as Record<string, unknown>);
              })
              .catch((retryErr) => {
                console.error('[system-state RPC 重试失败]', machineId, (retryErr as Error).message);
              });
          }, 3000);
        }
      });
  };

  doSend();

  return () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  };
}

export function useMqttConnect(): void {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const prevSelectedRef = useRef<string | null>(null);
  const cancelStateRpcRef = useRef<(() => void) | null>(null);

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

      // MQTT 连通后立即为当前选中设备订阅主题并发起 RPC
      if (state === 'connected') {
        const currentId = useDeviceStore.getState().selectedId;
        if (!currentId) return;
        const device = useDeviceStore.getState().devices.find((d) => d.id === currentId);
        if (!device || device.serverId !== serverId) return;

        pool.subscribeDevice(serverId, currentId);
        pool.switchFollowing(serverId, null, currentId);
        cancelStateRpcRef.current?.();
        cancelStateRpcRef.current = sendStateRpcWithRetry(pool, currentId);
      }
    };

    pool.onStateChange(onStateChange);

    // 并行创建所有 server 连接
    for (const server of servers) {
      if (!pool.getClient(server.id)) {
        pool.create(server);
      }
    }

    // StrictMode 重挂载兜底：连接已就绪时直接发起（onStateChange 可能已触发过，用 cancelStateRpcRef 去重）
    const currentId = useDeviceStore.getState().selectedId;
    if (currentId && !cancelStateRpcRef.current) {
      const device = useDeviceStore.getState().devices.find((d) => d.id === currentId);
      if (device && pool.isConnected(device.serverId)) {
        pool.subscribeDevice(device.serverId, currentId);
        pool.switchFollowing(device.serverId, null, currentId);
        cancelStateRpcRef.current = sendStateRpcWithRetry(pool, currentId);
      }
      prevSelectedRef.current = currentId;
    }

    return () => {
      cancelStateRpcRef.current?.();
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

    // 请求设备状态（含重试）
    cancelStateRpcRef.current?.();
    cancelStateRpcRef.current = sendStateRpcWithRetry(pool, selectedId);

    prevSelectedRef.current = selectedId;
  }, [selectedId]);
}
