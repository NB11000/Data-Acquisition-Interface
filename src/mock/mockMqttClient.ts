type MessageHandler = (topic: string, payload: Uint8Array) => void;

interface MockSubscription {
  topic: string;
}

export class MockMqttClient {
  private subscriptions: MockSubscription[] = [];
  private connected = false;
  private clientId: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  // ── Issue 4 guard: prevent double-connect in StrictMode ──
  connect(): void {
    if (this.connected) return;
    setTimeout(() => {
      this.connected = true;
      console.log(`[MockMqtt] ${this.clientId} connected`);
      if (this.onConnect) this.onConnect();
    }, 100);
  }

  subscribe(topic: string): void {
    // Dedup exact-topic entries (helps StrictMode double-mount)
    if (this.subscriptions.some((s) => s.topic === topic)) return;
    this.subscriptions.push({ topic });
    console.log(`[MockMqtt] ${this.clientId} subscribed: ${topic}`);
  }

  // ── Issue 7: use topicMatches for wildcard unsubscribe ──
  unsubscribe(topic: string): void {
    const before = this.subscriptions.length;
    this.subscriptions = this.subscriptions.filter(
      (s) => !this.topicMatches(topic, s.topic),
    );
    console.log(
      `[MockMqtt] ${this.clientId} unsubscribed: ${topic} (removed ${before - this.subscriptions.length})`,
    );
  }

  publish(topic: string, payload: string | Uint8Array): void {
    console.log(`[MockMqtt] ${this.clientId} publish → ${topic}`);
  }

  /** inject message (used by mock generators) */
  injectMessage(topic: string, payload: Uint8Array): void {
    if (!this.connected) return;
    for (const sub of this.subscriptions) {
      if (this.topicMatches(sub.topic, topic) && this.onMessage) {
        this.onMessage(topic, payload);
        break;
      }
    }
  }

  /** simulate disconnect */
  injectDisconnect(): void {
    this.connected = false;
    if (this.onDisconnect) this.onDisconnect();
  }

  /** simulate reconnect */
  injectReconnect(): void {
    this.connected = true;
    if (this.onConnect) this.onConnect();
  }

  /** no-op for interface compliance */
  end(_force?: boolean): void {
    this.connected = false;
  }

  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onMessage: MessageHandler | null = null;

  private topicMatches(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');

    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] === '#') return true;
      if (patternParts[i] === '+') continue;
      if (i >= topicParts.length) return false;
      if (patternParts[i] !== topicParts[i]) return false;
    }
    return patternParts.length === topicParts.length;
  }

  get isConnected(): boolean {
    return this.connected;
  }
}
