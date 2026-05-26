/**
 * 高性能环形缓冲区 — 预分配 TypedArray，零 GC 压力
 * 用于存储波形数据 double[1000] 帧
 */
export class RingBuffer {
  private buffer: Float64Array;
  private capacity: number;
  private frameSize: number;
  private writeIndex = 0;

  constructor(frameSize: number, maxFrames: number) {
    this.frameSize = frameSize;
    this.capacity = maxFrames;
    this.buffer = new Float64Array(frameSize * maxFrames);
  }

  push(frame: Float64Array | number[]): number {
    const offset = this.writeIndex * this.frameSize;
    if (frame instanceof Float64Array) {
      this.buffer.set(frame, offset);
    } else {
      for (let i = 0; i < Math.min(frame.length, this.frameSize); i++) {
        this.buffer[offset + i] = frame[i];
      }
    }
    const idx = this.writeIndex;
    this.writeIndex = (this.writeIndex + 1) % this.capacity;
    return idx;
  }

  getRawBuffer(): Float64Array { return this.buffer; }
  getFrameSize(): number { return this.frameSize; }
  getCapacity(): number { return this.capacity; }
  getWriteIndex(): number { return this.writeIndex; }

  getRecentFrames(count: number): Float64Array[] {
    const frames: Float64Array[] = [];
    const actual = Math.min(count, this.capacity);
    for (let i = 0; i < actual; i++) {
      const idx = (this.writeIndex - actual + i + this.capacity) % this.capacity;
      const offset = idx * this.frameSize;
      frames.push(this.buffer.slice(offset, offset + this.frameSize));
    }
    return frames;
  }

  clear(): void {
    this.buffer.fill(0);
    this.writeIndex = 0;
  }
}
