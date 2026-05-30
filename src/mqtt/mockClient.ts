import type { MqttClientLike } from './mqttClientLike';

type MessageHandler = (topic: string, payload: Uint8Array) => void;

export class MockMqttClient implements MqttClientLike {
  private _connected = false;
  private _clientId: string;
  private _subscriptions: Map<string, MessageHandler[]> = new Map();

  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onMessage: ((topic: string, payload: Uint8Array) => void) | null = null;

  constructor(clientId: string) {
    this._clientId = clientId;
  }

  connect(): void {
    this._connected = true;
    if (this.onConnect) this.onConnect();
  }

  subscribe(topic: string): void {
    if (this._subscriptions.has(topic)) return;
    const handler: MessageHandler = (t, p) => {
      if (this.onMessage) this.onMessage(t, p);
    };
    this._subscriptions.set(topic, [handler]);
  }

  unsubscribe(topic: string): void {
    this._subscriptions.delete(topic);
  }

  publish(topic: string, payload: string | Uint8Array): void {
    const msg = typeof payload === 'string' ? new TextEncoder().encode(payload) : payload;
    for (const [subTopic, handlers] of this._subscriptions) {
      if (this.topicMatches(subTopic, topic)) {
        for (const h of handlers) {
          h(topic, msg);
        }
      }
    }
  }

  /** 模拟外部注入消息（供 mockRpc 等使用） */
  injectMessage(topic: string, payload: Uint8Array): void {
    if (!this._connected) return;
    for (const [subTopic, handlers] of this._subscriptions) {
      if (this.topicMatches(subTopic, topic)) {
        for (const h of handlers) {
          h(topic, payload);
        }
        break;
      }
    }
  }

  end(force?: boolean): void {
    this._connected = false;
    this._subscriptions.clear();
  }

  get isConnected(): boolean {
    return this._connected;
  }

  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') {
        if (i >= topicParts.length) return false;
        continue;
      }
      if (i >= topicParts.length) return false;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return patternParts.length === topicParts.length;
  }
}
