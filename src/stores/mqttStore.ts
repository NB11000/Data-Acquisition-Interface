import { create } from 'zustand';

interface MqttStore {
  mqttConnected: boolean;
  willReceived: boolean;
  willDeviceId: string | null;

  setConnected: (v: boolean) => void;
  setWill: (deviceId: string) => void;
  clearWill: () => void;
}

export const useMqttStore = create<MqttStore>((set) => ({
  mqttConnected: false,
  willReceived: false,
  willDeviceId: null,

  setConnected: (v) => set({ mqttConnected: v }),
  setWill: (deviceId) => set({ willReceived: true, willDeviceId: deviceId }),
  clearWill: () => set({ willReceived: false, willDeviceId: null }),
}));
