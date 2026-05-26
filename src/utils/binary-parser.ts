const WAVEFORM_SAMPLE_COUNT = 1000;
const WAVEFORM_PAYLOAD_BYTES = WAVEFORM_SAMPLE_COUNT * Float64Array.BYTES_PER_ELEMENT; // 8000

/** 解析波形二进制负载: double[1000] 小端序 → Float64Array */
export function parseWaveformBinary(payload: Uint8Array): Float64Array {
  if (payload.byteLength < WAVEFORM_PAYLOAD_BYTES) {
    throw new Error(`波形数据长度不足: ${payload.byteLength} < ${WAVEFORM_PAYLOAD_BYTES}`);
  }
  const buffer = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  );
  return new Float64Array(buffer, 0, WAVEFORM_SAMPLE_COUNT);
}
