import type { MqttClientLike } from './client';
import type { MockMqttClient } from '../mock/mockMqttClient';
import { rpcRequestTopic } from './topics';
import { generateGuid } from '../utils/id';
import type { CommandResult } from './types';
import { handleMockRpc } from '../mock/mockRpc';
import { MQTT_MODE } from '../env';

interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

const pendingRpcs = new Map<string, PendingRpc>();

// ── Issue 11: Called by the single onMessage handler in router.ts ──

/**
 * Attempt to resolve a pending RPC from an incoming message.
 * Returns true if the message was an RPC response (consumed); false otherwise.
 */
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

export function sendRpcCommand(
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
      handleMockRpc(client as MockMqttClient, machineId, method, corrId);
    } else {
      const data = JSON.stringify(payload ?? {});
      client.publish(topic, data);
    }
  });
}

export function clearPendingRpcs(): void {
  for (const [corrId, pending] of pendingRpcs) {
    clearTimeout(pending.timeout);
    pending.reject(new Error('MQTT 连接已断开'));
  }
  pendingRpcs.clear();
}
