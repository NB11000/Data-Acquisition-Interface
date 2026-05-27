import type { LowFreqSample } from '../mqtt/types';
import type { MockMqttClient } from './mockMqttClient';

export function startMockLowFreq(
  mockClient: MockMqttClient,
  machineId: string,
  intervalMs = 7000,
): () => void {
  let running = true;
  let index = 0;

  const tick = () => {
    if (!running) return;

    const sample: LowFreqSample = {
      timestamp: index++,
      utc: new Date().toISOString(),
      ch1: 1.0 + (Math.random() - 0.5) * 0.2,
      ch2: 0.8 + (Math.random() - 0.5) * 0.15,
      vis: 12.0 + (Math.random() - 0.5) * 2,
      cn2: 8.9e-13 + (Math.random() - 0.5) * 1e-13,
      temp: 22.5 + (Math.random() - 0.5) * 2,
      humi: 60 + (Math.random() - 0.5) * 10,
      press: 1013.25 + (Math.random() - 0.5) * 5,
      windSpd: 2.5 + (Math.random() - 0.5) * 1,
      rain: Math.random() > 0.9 ? Math.random() * 2 : 0,
      windDir: Math.random() * 360,
    };

    const json = JSON.stringify(sample);
    mockClient.injectMessage(
      `daq/${machineId}/lowfreq`,
      new TextEncoder().encode(json),
    );
  };

  tick(); // 立即发送第一个采样
  const timer = setInterval(tick, intervalMs);

  return () => {
    running = false;
    clearInterval(timer);
  };
}
