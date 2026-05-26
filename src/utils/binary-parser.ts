/** 解析波形二进制负载: double[1000] 小端序 → Float64Array */
export function parseWaveformBinary(payload: Uint8Array): Float64Array {
  if (payload.byteLength < 8000) {
    throw new Error(`波形数据长度不足: ${payload.byteLength} < 8000`);
  }
  const buffer = payload.buffer.slice(
    payload.byteOffset,
    payload.byteOffset + payload.byteLength
  );
  return new Float64Array(buffer, 0, 1000);
}
