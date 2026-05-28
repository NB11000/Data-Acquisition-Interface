import { create } from 'zustand';
import type { LaserStateDto } from '../mqtt/types';
import type { ButtonPhase } from './collectorStore';

interface LaserStore extends LaserStateDto {
  connectButtonPhase: ButtonPhase;
  laserButtonPhase: ButtonPhase;

  applyState: (s: LaserStateDto) => void;
  setSerialConnected: (v: boolean) => void;
  setEmissionOn: (v: boolean) => void;
  setButtonPhase: (btn: 'connect' | 'laser', phase: ButtonPhase) => void;
  reset: () => void;
}

const initial: LaserStateDto & { connectButtonPhase: ButtonPhase; laserButtonPhase: ButtonPhase } = {
  serialConnected: false,
  emissionOn: false,
  portName: '',
  lastMessage: '',
  connectButtonPhase: 'idle',
  laserButtonPhase: 'idle',
};

export const useLaserStore = create<LaserStore>((set) => ({
  ...initial,

  applyState: (s) =>
    set({
      serialConnected: s.serialConnected,
      emissionOn: s.emissionOn,
      portName: s.portName ?? '',
      lastMessage: s.lastMessage ?? '',
    }),

  setSerialConnected: (v) => set({ serialConnected: v }),
  setEmissionOn: (v) => set({ emissionOn: v }),

  setButtonPhase: (btn, phase) =>
    set(btn === 'connect' ? { connectButtonPhase: phase } : { laserButtonPhase: phase }),

  reset: () => set(initial),
}));
