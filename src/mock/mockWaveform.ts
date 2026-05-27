import type { MockMqttClient } from './mockMqttClient';

export function startMockWaveform(
  mockClient: MockMqttClient,
  machineId: string,
  intervalMs = 100,
): () => void {
  let running = true;
  let t = 0;

  const tick = () => {
    if (!running) return;

    const ch1 = generateFrame(t, 1.0, 50, 0.05);
    const ch2 = generateFrame(t, 0.8, 30, 0.07);

    mockClient.injectMessage(`daq/${machineId}/waveform/ch1`, ch1);
    mockClient.injectMessage(`daq/${machineId}/waveform/ch2`, ch2);
    t++;
  };

  tick(); // 立即发送第一帧
  const timer = setInterval(tick, intervalMs);

  return () => {
    running = false;
    clearInterval(timer);
  };
}

function generateFrame(
  baseIndex: number,
  amplitude: number,
  frequency: number,
  noise: number,
): Uint8Array {
  const buffer = new ArrayBuffer(8000);
  const view = new DataView(buffer);
  for (let i = 0; i < 1000; i++) {
    const t = (baseIndex * 1000 + i) / 1000;
    const value =
      amplitude * Math.sin(2 * Math.PI * frequency * t) +
      (Math.random() - 0.5) * noise;
    view.setFloat64(i * 8, value, true);
  }
  return new Uint8Array(buffer);
}
