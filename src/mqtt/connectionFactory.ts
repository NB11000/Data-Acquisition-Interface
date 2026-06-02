import mqtt, { type MqttClient } from 'mqtt';
import type { MqttClientLike } from './mqttClientLike';
import type { MqttServer } from '../stores/serverStore';
import { MockMqttClient } from './mockClient';
import { MQTT_MODE } from '../env';

// ── 工厂接口 ──

export interface ConnectionFactory {
  createConnection(server: MqttServer): MqttClientLike;
}

// ── Mock 工厂 ──

export function createMockFactory(): ConnectionFactory {
  return {
    createConnection(server: MqttServer): MqttClientLike {
      return new MockMqttClient(server.id);
    },
  };
}

// ── Real 工厂 ──
// 从 client.ts 迁移原 RealMqttAdapter 逻辑

class RealMqttAdapter implements MqttClientLike {
  private client: MqttClient;

  onConnect: (() => void) | null = null;
  onDisconnect: (() => void) | null = null;
  onMessage: ((topic: string, payload: Uint8Array) => void) | null = null;

  constructor(client: MqttClient) {
    this.client = client;

    this.client.on('connect', () => {
      if (this.onConnect) this.onConnect();
    });

    this.client.on('message', (topic: string, payload: Buffer) => {
      if (this.onMessage) this.onMessage(topic, new Uint8Array(payload));
    });

    this.client.on('close', () => {
      if (this.onDisconnect) this.onDisconnect();
    });
  }

  connect(): void {}

  subscribe(topic: string): void {
    this.client.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this.client.unsubscribe(topic);
  }

  publish(topic: string, payload: string | Uint8Array): void {
    const msg = typeof payload === 'string' ? payload : Buffer.from(payload);
    this.client.publish(topic, msg);
  }

  end(force?: boolean): void {
    this.client.end(force);
  }

  /** Real 模式无需注入消息，no-op */
  injectMessage(_topic: string, _payload: Uint8Array): void {}

  get isConnected(): boolean {
    return this.client.connected;
  }
}

export function createRealFactory(): ConnectionFactory {
  return {
    createConnection(server: MqttServer): MqttClientLike {
      const url = server.brokerUrl;
      const client = mqtt.connect(url, {
        clientId: server.id,
        username: server.username,
        password: server.password,
        ca: server.caCert ? [server.caCert] : undefined,
        rejectUnauthorized: !!server.caCert,
        keepalive: 30,
      });
      return new RealMqttAdapter(client);
    },
  };
}

// ── 便捷默认工厂 ──

export function createDefaultFactory(): ConnectionFactory {
  if (MQTT_MODE === 'mock') {
    return createMockFactory();
  }
  return createRealFactory();
}
