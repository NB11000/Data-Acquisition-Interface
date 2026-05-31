import type { MqttClientLike } from './mqttClientLike';
import type { ConnectionFactory } from './connectionFactory';
import type { MqttServer } from '../stores/serverStore';
import { useDeviceStore } from '../stores/deviceStore';
import { createDefaultFactory } from './connectionFactory';

export type ConnectionState = 'initializing' | 'connected' | 'disconnected' | 'reconnecting' | 'failed';

interface ServerContext {
  server: MqttServer;
  client: MqttClientLike;
  state: ConnectionState;
  deviceIds: Set<string>;
  retryCount: number;
  retryTimer: ReturnType<typeof setTimeout> | null;
}

type MessageListener = (data: { serverId: string; topic: string; payload: Uint8Array }) => void;
type StateChangeListener = (data: { serverId: string; state: ConnectionState; error?: string }) => void;

export class ConnectionPool {
  private factory: ConnectionFactory;
  private servers = new Map<string, ServerContext>();

  // $SYS 在线客户端缓存：serverId → 当前在线的 clientId 集合
  private _onlineClients = new Map<string, Set<string>>();

  private _messageListeners: MessageListener[] = [];
  private _stateChangeListeners: StateChangeListener[] = [];

  constructor(factory: ConnectionFactory) {
    this.factory = factory;
  }

  create(server: MqttServer): void {
    if (this.servers.has(server.id)) {
      this.destroy(server.id);
    }

    const client = this.factory.createConnection(server);

    client.onConnect = () => {
      const ctx = this.servers.get(server.id);
      if (!ctx) return;
      ctx.state = 'connected';
      ctx.retryCount = 0;
      this.emitStateChange(server.id, 'connected');
      this.subscribeSysTopics(client);

      // 重连后自动恢复该服务器下所有设备的常驻主题
      const allDevices = useDeviceStore.getState().devices;
      for (const d of allDevices) {
        if (d.serverId === server.id) {
          this.subscribeDevice(server.id, d.id);
        }
      }

      // 重连后恢复当前选中设备的跟随主题
      const selectedId = useDeviceStore.getState().selectedId;
      if (selectedId) {
        const selected = allDevices.find((d) => d.id === selectedId);
        if (selected && selected.serverId === server.id) {
          this.switchFollowing(server.id, null, selectedId);
        }
      }
    };

    client.onDisconnect = () => {
      const ctx = this.servers.get(server.id);
      if (!ctx || ctx.state === 'failed') return;
      this.startReconnect(server.id);
    };

    client.onMessage = (topic, payload) => {
      this.emitMessage(server.id, topic, payload);
    };

    const ctx: ServerContext = {
      server,
      client,
      state: 'initializing',
      deviceIds: new Set(),
      retryCount: 0,
      retryTimer: null,
    };

    this.servers.set(server.id, ctx);
    client.connect();

    if (ctx.state !== 'connected' && client.isConnected) {
      ctx.state = 'connected';
      ctx.retryCount = 0;
      this.emitStateChange(server.id, 'connected');
      this.subscribeSysTopics(client);
    }
  }

  destroy(serverId: string): void {
    const ctx = this.servers.get(serverId);
    if (!ctx) return;

    ctx.state = 'disconnected';
    this.emitStateChange(serverId, 'disconnected');
    this.clearRetry(serverId);
    ctx.client.onConnect = null;
    ctx.client.onDisconnect = null;
    ctx.client.onMessage = null;
    ctx.client.end(true);

    this.servers.delete(serverId);
    this._onlineClients.delete(serverId);
  }

  update(server: MqttServer): void {
    const ctx = this.servers.get(server.id);
    if (!ctx) return;

    const oldServer = ctx.server;
    const needsReconnect =
      oldServer.brokerUrl !== server.brokerUrl ||
      oldServer.port !== server.port ||
      oldServer.username !== server.username ||
      oldServer.password !== server.password ||
      oldServer.tls !== server.tls;

    ctx.server = server;

    if (!needsReconnect) return;

    const deviceIds = [...ctx.deviceIds];
    this.destroy(server.id);
    this.create(server);

    for (const deviceId of deviceIds) {
      this.subscribeDevice(server.id, deviceId);
    }
  }

  subscribeDevice(serverId: string, machineId: string): void {
    const ctx = this.servers.get(serverId);
    if (!ctx) return;

    const topics = [
      `daq/${machineId}/events/will`,
      `daq/${machineId}/events/state_changed`,
      `daq/${machineId}/events/device_alarm`,
      `$rpc/${machineId}/+/+/response`,
    ];

    for (const topic of topics) {
      ctx.client.subscribe(topic);
    }

    ctx.deviceIds.add(machineId);
  }

  unsubscribeDevice(serverId: string, machineId: string, keepConnection = false): void {
    const ctx = this.servers.get(serverId);
    if (!ctx) return;

    const topics = [
      `daq/${machineId}/events/will`,
      `daq/${machineId}/events/state_changed`,
      `daq/${machineId}/events/device_alarm`,
      `$rpc/${machineId}/+/+/response`,
    ];

    for (const topic of topics) {
      ctx.client.unsubscribe(topic);
    }

    ctx.deviceIds.delete(machineId);

    if (!keepConnection && ctx.deviceIds.size === 0) {
      this.destroy(serverId);
    }
  }

  switchFollowing(serverId: string, oldMachineId: string | null, newMachineId: string | null): void {
    const ctx = this.servers.get(serverId);
    if (!ctx) return;

    if (oldMachineId) {
      const followTopics = [
        `daq/${oldMachineId}/waveform/ch1`,
        `daq/${oldMachineId}/waveform/ch2`,
        `daq/${oldMachineId}/lowfreq`,
        `daq/${oldMachineId}/detection/alerts`,
      ];
      for (const topic of followTopics) {
        ctx.client.unsubscribe(topic);
      }
    }

    if (newMachineId) {
      const followTopics = [
        `daq/${newMachineId}/waveform/ch1`,
        `daq/${newMachineId}/waveform/ch2`,
        `daq/${newMachineId}/lowfreq`,
        `daq/${newMachineId}/detection/alerts`,
      ];
      for (const topic of followTopics) {
        ctx.client.subscribe(topic);
      }
    }
  }

  getState(serverId: string): ConnectionState {
    return this.servers.get(serverId)?.state ?? 'disconnected';
  }

  /** 获取原始客户端实例（供 mockRpc 等使用） */
  getClient(serverId: string): MqttClientLike | null {
    return this.servers.get(serverId)?.client ?? null;
  }

  getOnlineClients(serverId: string): Set<string> {
    let set = this._onlineClients.get(serverId);
    if (!set) {
      set = new Set();
      this._onlineClients.set(serverId, set);
    }
    return set;
  }

  addOnlineClient(serverId: string, clientId: string): void {
    this.getOnlineClients(serverId).add(clientId);
  }

  removeOnlineClient(serverId: string, clientId: string): void {
    const set = this._onlineClients.get(serverId);
    if (set) set.delete(clientId);
  }

  publish(serverId: string, topic: string, payload: string | Uint8Array): void {
    const ctx = this.servers.get(serverId);
    if (!ctx || ctx.state !== 'connected') return;
    ctx.client.publish(topic, payload);
  }

  isConnected(serverId: string): boolean {
    return this.servers.get(serverId)?.client.isConnected ?? false;
  }

  onMessage(listener: MessageListener): void {
    this._messageListeners.push(listener);
  }

  offMessage(listener: MessageListener): void {
    this._messageListeners = this._messageListeners.filter((l) => l !== listener);
  }

  onStateChange(listener: StateChangeListener): void {
    this._stateChangeListeners.push(listener);
  }

  offStateChange(listener: StateChangeListener): void {
    this._stateChangeListeners = this._stateChangeListeners.filter((l) => l !== listener);
  }

  private subscribeSysTopics(client: MqttClientLike): void {
    client.subscribe('$SYS/brokers/+/clients/+/connected');
    client.subscribe('$SYS/brokers/+/clients/+/disconnected');
  }

  private startReconnect(serverId: string): void {
    const ctx = this.servers.get(serverId);
    if (!ctx) return;

    if (ctx.retryCount >= 3) {
      ctx.state = 'failed';
      this.emitStateChange(serverId, 'failed');
      return;
    }

    const delay = Math.pow(2, ctx.retryCount) * 1000; // 1s, 2s, 4s
    ctx.state = 'reconnecting';
    ctx.retryCount++;
    this.emitStateChange(serverId, 'reconnecting');

    ctx.retryTimer = setTimeout(() => {
      ctx.client.connect();
      if (ctx.client.isConnected) {
        ctx.state = 'connected';
        ctx.retryCount = 0;
        this.emitStateChange(serverId, 'connected');
        this.subscribeSysTopics(ctx.client);
      } else {
        this.startReconnect(serverId);
      }
    }, delay);
  }

  private clearRetry(serverId: string): void {
    const ctx = this.servers.get(serverId);
    if (ctx?.retryTimer) {
      clearTimeout(ctx.retryTimer);
      ctx.retryTimer = null;
    }
  }

  private emitMessage(serverId: string, topic: string, payload: Uint8Array): void {
    for (const listener of this._messageListeners) {
      listener({ serverId, topic, payload });
    }
  }

  private emitStateChange(serverId: string, state: ConnectionState, error?: string): void {
    // 连接断开/失败时，该 server 下所有设备 isOnline 设为 null
    if (state === 'disconnected' || state === 'reconnecting' || state === 'failed') {
      const deviceState = useDeviceStore.getState();
      for (const d of deviceState.devices) {
        if (d.serverId === serverId && d.isOnline !== null) {
          deviceState.setOnline(d.id, null);
        }
      }
    }
    for (const listener of this._stateChangeListeners) {
      listener({ serverId, state, error });
    }
  }
}

// ── 默认导出：创建 ConnectionPool ──

export default function createConnectionPool(
  factory?: ConnectionFactory,
): ConnectionPool {
  const f = factory ?? createDefaultFactory();
  return new ConnectionPool(f);
}
