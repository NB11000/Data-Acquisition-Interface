import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useServerStore } from './serverStore';

export interface Device {
  id: string;
  name: string;
  serverId: string;
  isOnline: boolean | null;
}

interface DeviceStore {
  devices: Device[];
  selectedId: string | null;
  searchText: string;

  addDevice: (d: Device) => void;
  removeDevice: (id: string) => void;
  setSelected: (id: string) => void;
  setOnline: (id: string, online: boolean | null) => void;
  setSearch: (text: string) => void;
  getDevicesByServer: (serverId: string) => Device[];
  getFilteredDevices: () => { serverId: string; devices: Device[] }[];
  updateDeviceName: (id: string, name: string) => void;
}

export const useDeviceStore = create<DeviceStore>()(
  persist(
    (set, get) => ({
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

      setOnline: (id, online: boolean | null) =>
        set((s) => ({
          devices: s.devices.map((d) =>
            d.id === id ? { ...d, isOnline: online } : d,
          ),
        })),

      setSearch: (text) => set({ searchText: text }),

      getDevicesByServer: (serverId) =>
        get().devices.filter((d) => d.serverId === serverId),

      getFilteredDevices: () => {
        const servers = useServerStore.getState().servers;
        return servers.map((srv) => ({
          serverId: srv.id,
          devices: get().devices.filter((d) => d.serverId === srv.id),
        }));
      },

      updateDeviceName: (id, name) =>
        set((s) => ({
          devices: s.devices.map((d) =>
            d.id === id ? { ...d, name } : d,
          ),
        })),
    }),
    { name: 'devices' },
  ),
);
