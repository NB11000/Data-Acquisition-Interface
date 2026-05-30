import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PoolConnectionState = 'initializing' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

export interface MqttServer {
  id: string;
  name: string;
  brokerUrl: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
  connected: boolean;
  connectionState?: PoolConnectionState;
  caCert?: string;
}

interface ServerStore {
  servers: MqttServer[];
  addServer: (server: MqttServer) => void;
  removeServer: (id: string) => void;
  updateServer: (id: string, partial: Partial<MqttServer>) => void;
  findDuplicate: (brokerUrl: string, port: number, username: string) => MqttServer | undefined;
  setConnected: (id: string, connected: boolean) => void;
  setConnectionState: (id: string, state: PoolConnectionState) => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set, get) => ({
      servers: [],

      addServer: (server) =>
        set((s) => ({ servers: [...s.servers, server] })),

      removeServer: (id) =>
        set((s) => ({ servers: s.servers.filter((srv) => srv.id !== id) })),

      updateServer: (id, partial) =>
        set((s) => ({
          servers: s.servers.map((srv) =>
            srv.id === id ? { ...srv, ...partial } : srv,
          ),
        })),

      findDuplicate: (brokerUrl, port, username) =>
        get().servers.find(
          (s) =>
            s.brokerUrl === brokerUrl &&
            s.port === port &&
            s.username === username,
        ),

      setConnected: (id, connected) =>
        set((s) => ({
          servers: s.servers.map((srv) =>
            srv.id === id ? { ...srv, connected } : srv,
          ),
        })),

      setConnectionState: (id, state) =>
        set((s) => ({
          servers: s.servers.map((srv) =>
            srv.id === id ? { ...srv, connectionState: state } : srv,
          ),
        })),
    }),
    { name: 'mqttServers' },
  ),
);
