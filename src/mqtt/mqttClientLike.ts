// MqttClientLike 统一接口 —— MockMqttClient 和 RealMqttAdapter 都实现此接口
// 上层代码无需知道具体实现

export interface MqttClientLike {
  onConnect: (() => void) | null;
  onDisconnect: (() => void) | null;
  onMessage: ((topic: string, payload: Uint8Array) => void) | null;
  connect(): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, payload: string | Uint8Array): void;
  /** 模拟注入消息（Mock 实现路由分发；Real 实现为 no-op） */
  injectMessage(topic: string, payload: Uint8Array): void;
  end(force?: boolean): void;
  readonly isConnected: boolean;
}
