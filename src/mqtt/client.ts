import mqtt, { type MqttClient } from 'mqtt';
import { MockMqttClient } from '../mock/mockMqttClient';
import { MQTT_MODE, BROKER_URL, BROKER_USERNAME, BROKER_PASSWORD } from '../env';

// ── Unified interface (Issue 1) ──
// Both MockMqttClient and RealMqttAdapter satisfy this shape so that
// router / rpc / hooks never need to cast to a concrete implementation.

export interface MqttClientLike {
  onConnect: (() => void) | null;
  onDisconnect: (() => void) | null;
  onMessage: ((topic: string, payload: Uint8Array) => void) | null;
  connect(): void;
  subscribe(topic: string): void;
  unsubscribe(topic: string): void;
  publish(topic: string, payload: string | Uint8Array): void;
  end(force?: boolean): void;
  readonly isConnected: boolean;
}

// ── Real MQTT adapter (Issue 1) ──
// Wraps mqtt.js EventEmitter API so callers only deal with callback properties.

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

  connect(): void {
    // mqtt.connect() already connects; no-op for re-connect scenarios.
  }

  subscribe(topic: string): void {
    this.client.subscribe(topic);
  }

  unsubscribe(topic: string): void {
    this.client.unsubscribe(topic);
  }

  publish(topic: string, payload: string | Uint8Array): void {
    // mqtt.js expects Buffer, not Uint8Array
    const msg = typeof payload === 'string' ? payload : Buffer.from(payload);
    this.client.publish(topic, msg);
  }

  end(force?: boolean): void {
    this.client.end(force);
  }

  get isConnected(): boolean {
    return this.client.connected;
  }
}

// ── Module-level singleton ──

let client: MqttClientLike | null = null;

export function getMqttClient(): MqttClientLike {
  if (!client) {
    throw new Error('MQTT client not initialized. Call initMqttClient() first.');
  }
  return client;
}

/** Null-safe accessor used by hooks that need to survive StrictMode remounts. */
export function getMqttClientSafely(): MqttClientLike | null {
  return client;
}

export function initMqttClient(clientId: string): MqttClientLike {
  if (MQTT_MODE === 'mock') {
    const mock = new MockMqttClient(clientId);
    client = mock;
    return mock;
  }

  const real = mqtt.connect(BROKER_URL, {
    clientId,
    username: BROKER_USERNAME,
    password: BROKER_PASSWORD,
    keepalive: 30,
  });

  const adapter = new RealMqttAdapter(real);
  client = adapter;
  return adapter;
}

export function destroyMqttClient(): void {
  if (client) {
    client.end(true);
    client = null;
  }
}
