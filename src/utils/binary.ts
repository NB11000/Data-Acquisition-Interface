export function parseWaveformBinary(buffer: ArrayBuffer): Float64Array {
  if (buffer.byteLength !== 8000) {
    console.warn(`[binary] Expected 8000 bytes, got ${buffer.byteLength}`);
    return new Float64Array(1000);
  }
  const data = new Float64Array(1000);
  const view = new DataView(buffer);
  for (let i = 0; i < 1000; i++) {
    data[i] = view.getFloat64(i * 8, true); // little-endian
  }
  return data;
}
