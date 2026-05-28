import { create } from 'zustand';
import type { DeviceAlarm } from '../mqtt/types';

interface AlarmStore {
  alarms: DeviceAlarm[];
  unreadCount: number;

  add: (a: DeviceAlarm) => void;
  markAllRead: () => void;
}

export const useAlarmStore = create<AlarmStore>((set) => ({
  alarms: [],
  unreadCount: 0,

  add: (a) =>
    set((s) => ({
      alarms: [a, ...s.alarms].slice(0, 200),
      unreadCount: s.unreadCount + 1,
    })),

  markAllRead: () => set({ unreadCount: 0 }),
}));
