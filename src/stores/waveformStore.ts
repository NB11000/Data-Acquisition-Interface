import { create } from 'zustand';

export interface WaveformFrame {
  timestamp: number;
  data: Float64Array;
}

const MAX_FRAMES = 200;

interface WaveformStore {
  ch1: WaveformFrame[];
  ch2: WaveformFrame[];

  appendCh1: (data: Float64Array, ts: number) => void;
  appendCh2: (data: Float64Array, ts: number) => void;
  clear: () => void;
}

export const useWaveformStore = create<WaveformStore>((set) => ({
  ch1: [],
  ch2: [],

  appendCh1: (data, ts) =>
    set((s) => ({
      ch1: s.ch1.length >= MAX_FRAMES
        ? [...s.ch1.slice(1), { timestamp: ts, data }]
        : [...s.ch1, { timestamp: ts, data }],
    })),

  appendCh2: (data, ts) =>
    set((s) => ({
      ch2: s.ch2.length >= MAX_FRAMES
        ? [...s.ch2.slice(1), { timestamp: ts, data }]
        : [...s.ch2, { timestamp: ts, data }],
    })),

  clear: () => set({ ch1: [], ch2: [] }),
}));
