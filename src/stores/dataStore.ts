import { create } from 'zustand';
import type { LowFreqSample } from '../mqtt/types';

const MAX_SAMPLES = 500;

interface DataStore {
  samples: LowFreqSample[];

  append: (s: LowFreqSample) => void;
  clear: () => void;
}

export const useDataStore = create<DataStore>((set) => ({
  samples: [],

  append: (sample) =>
    set((s) => ({
      samples:
        s.samples.length >= MAX_SAMPLES
          ? [...s.samples.slice(1), sample]
          : [...s.samples, sample],
    })),

  clear: () => set({ samples: [] }),
}));
