import { create } from 'zustand';

export interface Device {
  id: string;
  name: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  isOnline: boolean;
}

interface DeviceStore {
  devices: Device[];
  selectedId: string | null;
  searchText: string;

  addDevice: (d: Device) => void;
  removeDevice: (id: string) => void;
  setSelected: (id: string) => void;
  setOnline: (id: string, online: boolean) => void;
  setSearch: (text: string) => void;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  devices: [],
  selectedId: null,
  searchText: '',

  addDevice: (d) =>
    set((s) => ({ devices: [...s.devices, d] })),
  removeDevice: (id) =>
    set((s) => ({
      devices: s.devices.filter((d) => d.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  setSelected: (id) => set({ selectedId: id }),
  setOnline: (id, online) =>
    set((s) => ({
      devices: s.devices.map((d) =>
        d.id === id ? { ...d, isOnline: online } : d,
      ),
    })),
  setSearch: (text) => set({ searchText: text }),
}));
