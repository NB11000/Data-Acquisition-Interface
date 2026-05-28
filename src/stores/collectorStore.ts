import { create } from 'zustand';
import type { CollectorStateDto } from '../mqtt/types';

export type ButtonPhase = 'idle' | 'sending' | 'running' | 'error';

interface CollectorStore extends CollectorStateDto {
  openButtonPhase: ButtonPhase;
  startButtonPhase: ButtonPhase;

  applyState: (s: CollectorStateDto) => void;
  setDeviceOpened: (v: boolean) => void;
  setAcquiring: (v: boolean) => void;
  setButtonPhase: (btn: 'open' | 'start', phase: ButtonPhase) => void;
  reset: () => void;
}

const initial: CollectorStateDto & { openButtonPhase: ButtonPhase; startButtonPhase: ButtonPhase } = {
  processConnected: false,
  deviceOpened: false,
  acquiring: false,
  lastMessage: '',
  openButtonPhase: 'idle',
  startButtonPhase: 'idle',
};

export const useCollectorStore = create<CollectorStore>((set) => ({
  ...initial,

  applyState: (s) =>
    set({
      processConnected: s.processConnected,
      deviceOpened: s.deviceOpened,
      acquiring: s.acquiring,
      lastMessage: s.lastMessage ?? '',
    }),

  setDeviceOpened: (v) => set({ deviceOpened: v }),
  setAcquiring: (v) => set({ acquiring: v }),

  setButtonPhase: (btn, phase) =>
    set(btn === 'open' ? { openButtonPhase: phase } : { startButtonPhase: phase }),

  reset: () => set(initial),
}));
