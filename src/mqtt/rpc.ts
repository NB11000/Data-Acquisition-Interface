import type { ConnectionPool } from './connectionPool';
import type { MqttClientLike } from './client';
import type { MockMqttClient as OldMockMqttClient } from '../mock/mockMqttClient';
import { rpcRequestTopic } from './topics';
import { generateGuid } from '../utils/id';
import type { CommandResult } from './types';
import { handleMockRpc } from '../mock/mockRpc';
import { MQTT_MODE } from '../env';
import { useDeviceStore } from '../stores/deviceStore';
import { useServerStore } from '../stores/serverStore';

interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingRpcs = new Map<string, PendingRpc>();

/** 仅测试用：暴露内部 pendingRpcs Map */
export function pendingRpcsForTest(): Map<string, PendingRpc> {
  return pendingRpcs;
}

// ── Issue 11: RPC 响应解析（tryResolveRpc 被 router 调用，参数不变） ──

export function tryResolveRpc(topic: string, payload: Uint8Array): boolean {
  const match = topic.match(/\$rpc\/[^/]+\/[^/]+\/([^/]+)\/response/);
  if (!match) return false;

  const corrId = match[1];
  const pending = pendingRpcs.get(corrId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingRpcs.delete(corrId);
    const result = JSON.parse(new TextDecoder().decode(payload)) as CommandResult;
    pending.resolve(result);
  }
  return true;
}

// ── Issue 3: 多连接版 sendRpcCommand ──

/**
 * 发送 RPC 指令（多连接版本）。
 * 通过 deviceStore 查 MachineId → serverId，再通过 ConnectionPool 发布。
 * 发送前检查连接状态，若未连接则立即 reject CONNECTION_LOST。
 */
export function sendRpcCommand(
  poolOrClient: ConnectionPool | MqttClientLike,
  machineId: string,
  method: string,
  payload?: object,
): Promise<CommandResult> {
  // 兼容旧签名：第一个参数是 MqttClientLike（向后兼容）
  if (isMqttClientLike(poolOrClient)) {
    return sendRpcCommandLegacy(poolOrClient, machineId, method, payload);
  }

  const pool = poolOrClient;

  const device = useDeviceStore.getState().devices.find((d) => d.id === machineId);
  if (!device) {
    return Promise.reject(new Error(`CONNECTION_LOST: 设备 ${machineId} 未找到`));
  }

  const serverId = device.serverId;

  // 发送前检查连接状态
  if (!pool.isConnected(serverId)) {
    const server = useServerStore.getState().servers.find((s) => s.id === serverId);
    const name = server?.name ?? serverId;
    return Promise.reject(new Error(`服务器 ${name} 未连接，请稍后重试`));
  }

  const corrId = generateGuid();
  const topic = rpcRequestTopic(machineId, method, corrId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRpcs.delete(corrId);
      reject(new Error('RPC 响应超时 (10s)'));
    }, 10000);

    pendingRpcs.set(corrId, { resolve, reject, timeout });

    if (MQTT_MODE === 'mock') {
      const client = pool.getClient(serverId);
      if (client) {
        handleMockRpc(client as unknown as OldMockMqttClient, machineId, method, corrId);
      }
    } else {
      const data = JSON.stringify(payload ?? {});
      pool.publish(serverId, topic, data);
    }
  });
}

// ── 向后兼容：原单连接版本 ──

function isMqttClientLike(value: unknown): value is MqttClientLike {
  return typeof value === 'object' && value !== null && 'publish' in value && 'subscribe' in value;
}

/** @deprecated 使用 sendRpcCommand(pool, machineId, method, payload) 替代 */
async function sendRpcCommandLegacy(
  client: MqttClientLike,
  machineId: string,
  method: string,
  payload?: object,
): Promise<CommandResult> {
  const corrId = generateGuid();
  const topic = rpcRequestTopic(machineId, method, corrId);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRpcs.delete(corrId);
      reject(new Error('RPC 响应超时 (10s)'));
    }, 10000);

    pendingRpcs.set(corrId, { resolve, reject, timeout });

    if (MQTT_MODE === 'mock') {
      handleMockRpc(client as unknown as OldMockMqttClient, machineId, method, corrId);
    } else {
      const data = JSON.stringify(payload ?? {});
      client.publish(topic, data);
    }
  });
}

// ── 清理 ──

export function clearPendingRpcs(): void {
  for (const [corrId, pending] of pendingRpcs) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('CONNECTION_LOST: 服务器连接已断开'));
  }
  pendingRpcs.clear();
}
