import { MqttClientManager } from './client';
import { generateRpcId } from '../../utils/rpc-id';
import type { CommandResult } from '../types/commands';
import type { RpcMethod } from '../types/mqtt';

interface PendingRpc {
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export class RpcManager {
  private pending = new Map<string, PendingRpc>();
  private cleanupFn: (() => void) | null = null;
  private responsePattern: RegExp;

  constructor(private machineId: string) {
    this.responsePattern = new RegExp(
      `^\\$rpc\\/${machineId}\\/.+\\/(.+)\\/response$`
    );
  }

  /** 发送 RPC 请求，返回 Promise<CommandResult> */
  send(method: RpcMethod, payload?: object): Promise<CommandResult> {
    const corrId = generateRpcId();
    const topic = `$rpc/${this.machineId}/${method}/${corrId}`;
    const client = MqttClientManager.getInstance();

    return new Promise<CommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(corrId);
        reject(new Error(`RPC 响应超时 (10s): ${method}`));
      }, 10000);

      this.pending.set(corrId, { resolve, reject, timeout });
      client.publish(topic, payload ?? {}, 1);
    });
  }

  /** 启动响应监听 */
  start(): void {
    const client = MqttClientManager.getInstance();
    this.cleanupFn = client.onMessage((topic, payload) => {
      const match = topic.match(this.responsePattern);
      if (!match) return;

      const corrId = match[1];
      const pending = this.pending.get(corrId);
      if (!pending) return;

      clearTimeout(pending.timeout);
      this.pending.delete(corrId);

      try {
        const result = JSON.parse(payload.toString()) as CommandResult;
        pending.resolve(result);
      } catch (err) {
        pending.reject(new Error('RPC 响应解析失败'));
      }
    });
  }

  /** 取消所有待处理请求 */
  stop(): void {
    this.cleanupFn?.();
    this.cleanupFn = null;
    for (const [corrId, pending] of this.pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('RPC 管理器已停止'));
      this.pending.delete(corrId);
    }
  }
}
