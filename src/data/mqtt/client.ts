// src/data/mqtt/client.ts
import mqtt, { MqttClient } from 'mqtt';
import type { MqttConnectionConfig } from '../types/mqtt';

type ConnectionHandler = (connected: boolean) => void;
type MessageHandler = (topic: string, payload: Buffer) => void;

export class MqttClientManager {
  private static instance: MqttClientManager;
  private client: MqttClient | null = null;
  private config: MqttConnectionConfig | null = null;
  private messageHandlers = new Set<MessageHandler>();
  private connectionHandlers = new Set<ConnectionHandler>();
  private subscribed = new Set<string>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  static getInstance(): MqttClientManager {
    if (!MqttClientManager.instance) {
      MqttClientManager.instance = new MqttClientManager();
    }
    return MqttClientManager.instance;
  }

  get isConnected(): boolean {
    return this.client?.connected ?? false;
  }

  get currentConfig(): MqttConnectionConfig | null {
    return this.config;
  }

  async connect(config: MqttConnectionConfig): Promise<void> {
    this.destroyed = false;
    this.config = config;

    const url = config.brokerUrl.startsWith('mqtt')
      ? config.brokerUrl
      : `mqtts://${config.brokerUrl}:${config.port ?? 8883}`;

    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(url, {
        clientId: config.clientId ?? `ui-${Date.now()}`,
        username: config.username,
        password: config.password,
        keepalive: 30,
        connectTimeout: 10000,
        rejectUnauthorized: false,
      });

      this.client.on('connect', () => {
        this.notifyConnection(true);
        resolve();
      });

      this.client.on('error', (err) => {
        if (!this.client?.connected) reject(err);
      });

      this.client.on('message', (topic, payload) => {
        for (const handler of this.messageHandlers) {
          handler(topic, payload);
        }
      });

      this.client.on('close', () => {
        this.notifyConnection(false);
        this.tryReconnect();
      });
    });
  }

  private tryReconnect(): void {
    if (this.destroyed || !this.config) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed && this.config) {
        this.connect(this.config).catch(() => {});
      }
    }, 3000);
  }

  subscribe(topics: string[], qos: 0 | 1 = 1): void {
    const newTopics = topics.filter((t) => !this.subscribed.has(t));
    if (newTopics.length === 0) return;
    this.client?.subscribe(newTopics, { qos }, (err) => {
      if (err) console.error('MQTT subscribe error:', err);
      else newTopics.forEach((t) => this.subscribed.add(t));
    });
  }

  unsubscribe(topics: string[]): void {
    const existing = topics.filter((t) => this.subscribed.has(t));
    if (existing.length === 0) return;
    this.client?.unsubscribe(existing, undefined, (err) => {
      if (err) console.error('MQTT unsubscribe error:', err);
    });
    for (const t of existing) this.subscribed.delete(t);
  }

  publish(topic: string, payload: object | string, qos: 0 | 1 = 1): void {
    const data = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.client?.publish(topic, data, { qos }, (err) => {
      if (err) console.error('MQTT publish error:', err);
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  private notifyConnection(connected: boolean): void {
    for (const handler of this.connectionHandlers) {
      handler(connected);
    }
  }

  disconnect(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const topics = [...this.subscribed];
    if (topics.length > 0) {
      this.client?.unsubscribe(topics, undefined, () => {});
    }
    this.subscribed.clear();
    this.client?.end(true);
    this.client = null;
    this.config = null;
  }
}
