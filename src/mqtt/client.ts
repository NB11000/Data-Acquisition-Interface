import mqtt, { type MqttClient } from 'mqtt';
import { MockMqttClient } from '../mock/mockMqttClient';
import { MQTT_MODE, BROKER_URL, BROKER_USERNAME, BROKER_PASSWORD } from '../env';

export type MqttClientLike = MqttClient | MockMqttClient;

let client: MqttClientLike | null = null;

export function getMqttClient(): MqttClientLike {
  if (!client) {
    throw new Error('MQTT client not initialized. Call initMqttClient() first.');
  }
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

  client = real;
  return real;
}

export function destroyMqttClient(): void {
  if (client) {
    if (MQTT_MODE === 'real') {
      (client as MqttClient).end(true);
    }
    client = null;
  }
}
