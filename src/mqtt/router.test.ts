import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockMqttClient } from './mockClient';
import type { MqttClientLike } from './mqttClientLike';
import type { ConnectionFactory } from './connectionFactory';
import type { MqttServer } from '../stores/serverStore';
import { ConnectionPool } from './connectionPool';
import { tryResolveRpc, pendingRpcsForTest } from './rpc';

// ── 辅助工具 ──

interface SpyFactory extends ConnectionFactory {
  clients: MockMqttClient[];
}

function createSpyFactory(): SpyFactory {
  const clients: MockMqttClient[] = [];
  return {
    clients,
    createConnection(server: MqttServer): MqttClientLike {
      const client = new MockMqttClient(server.id);
      clients.push(client);
      return client;
    },
  };
}

function makeServer(overrides: Partial<MqttServer> = {}): MqttServer {
  return {
    id: 's1', name: 'test', brokerUrl: 'mqtt://localhost', port: 1883,
    username: '', password: '', connected: false,
    ...overrides,
  };
}

describe('Router', () => {
  let pool: ConnectionPool;
  let spyFactory: SpyFactory;

  beforeEach(() => {
    spyFactory = createSpyFactory();
    pool = new ConnectionPool(spyFactory);
  });

  // ── RED 1: RPC 响应优先拦截 ──

  it('RPC 响应优先拦截，不在 domain handler 之前被 state_changed 消费', async () => {
    const { setupRouter } = await import('./router');
    const { useCollectorStore } = await import('../stores/collectorStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    // 重置 store
    useCollectorStore.setState({ deviceOpened: false, acquiring: false, processConnected: true });
    useMqttStore.setState({ willReceived: false });

    pool.create(makeServer());

    // 注册一个待处理的 RPC
    const { corrId, rpcPromise } = createPendingRpc();
    const rpcResultSpy = vi.fn();
    rpcPromise.then(rpcResultSpy);

    setupRouter(pool);

    const client = spyFactory.clients[0];

    // 先发一个 state_changed 消息
    const statePayload = new TextEncoder().encode(JSON.stringify({
      eventType: 'state_changed',
      source: 'collector',
      reason: 'test',
      message: 'test',
      state: { collector: { processConnected: true, deviceOpened: true, acquiring: false }, laser: { serialConnected: false, emissionOn: false } },
      timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/machine-01/events/state_changed', statePayload);

    // state_changed 不影响 RPC
    expect(rpcResultSpy).not.toHaveBeenCalled();
    expect(useCollectorStore.getState().deviceOpened).toBe(true);

    // 现在发 RPC 响应（包含同一个 corrId）
    const rpcPayload = new TextEncoder().encode(JSON.stringify({
      success: true, code: 'OK', message: 'ok', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.(`$rpc/machine-01/SYSTEM_STATE/${corrId}/response`, rpcPayload);

    await vi.waitFor(() => expect(rpcResultSpy).toHaveBeenCalled());
    expect(rpcResultSpy).toHaveBeenCalledTimes(1);
  });

  // ── RED 3: domain handler 分发顺序 ──

  it('state_changed 主题正确分派到 collector/laser/mqtt store', async () => {
    const { setupRouter } = await import('./router');
    const { useCollectorStore } = await import('../stores/collectorStore');
    const { useLaserStore } = await import('../stores/laserStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    useCollectorStore.setState({ deviceOpened: false, acquiring: false, processConnected: true });
    useLaserStore.setState({ serialConnected: false, emissionOn: false });
    useMqttStore.setState({ willReceived: true }); // will 标记应被清除

    pool.create(makeServer());
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      eventType: 'state_changed',
      source: 'system',
      reason: 'test',
      message: 'test',
      state: {
        collector: { processConnected: true, deviceOpened: true, acquiring: true },
        laser: { serialConnected: true, emissionOn: true },
      },
      timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/machine-01/events/state_changed', payload);

    expect(useCollectorStore.getState().deviceOpened).toBe(true);
    expect(useCollectorStore.getState().acquiring).toBe(true);
    expect(useLaserStore.getState().serialConnected).toBe(true);
    expect(useLaserStore.getState().emissionOn).toBe(true);
    expect(useMqttStore.getState().willReceived).toBe(false); // will 清除
  });

  it('will 主题分派到 mqtt store', async () => {
    const { setupRouter } = await import('./router');
    const { useMqttStore } = await import('../stores/mqttStore');
    useMqttStore.setState({ willReceived: false, willDeviceId: null });

    pool.create(makeServer());
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      eventType: 'process_crashed',
      source: 'mqtt_broker',
      reason: 'will_message',
      message: 'device offline',
    }));
    client.onMessage?.('daq/machine-02/events/will', payload);

    expect(useMqttStore.getState().willReceived).toBe(true);
    expect(useMqttStore.getState().willDeviceId).toBe('machine-02');
  });

  it('device_alarm 主题分派到 alarm store', async () => {
    const { setupRouter } = await import('./router');
    const { useAlarmStore } = await import('../stores/alarmStore');
    useAlarmStore.setState({ alarms: [] });

    pool.create(makeServer());
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      alarmType: 'overheat',
      device: 'machine-03',
      message: '温度过高',
      severity: 3,
      timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/machine-03/events/device_alarm', payload);

    expect(useAlarmStore.getState().alarms).toHaveLength(1);
    expect(useAlarmStore.getState().alarms[0].device).toBe('machine-03');
  });

  it('lowfreq 主题分派到 data store', async () => {
    const { setupRouter } = await import('./router');
    const { useDataStore } = await import('../stores/dataStore');
    useDataStore.setState({ samples: [] });

    pool.create(makeServer());
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const sample: Record<string, unknown> = {
      timestamp: Date.now(),
      utc: new Date().toISOString(),
      ch1: 1.1, ch2: 2.2, vis: 3.3, cn2: 4.4,
      temp: 25, humi: 60, press: 1013,
      windSpd: 5, rain: 0, windDir: 180,
    };
    const payload = new TextEncoder().encode(JSON.stringify(sample));
    client.onMessage?.('daq/machine-01/lowfreq', payload);

    expect(useDataStore.getState().samples).toHaveLength(1);
  });

  it('未知 topic 不触发任何 handler', async () => {
    const { setupRouter } = await import('./router');
    const { useMqttStore } = await import('../stores/mqttStore');
    const { useAlarmStore } = await import('../stores/alarmStore');
    const { useDataStore } = await import('../stores/dataStore');

    useMqttStore.setState({ willReceived: false });
    useAlarmStore.setState({ alarms: [] });
    useDataStore.setState({ samples: [] });

    pool.create(makeServer());
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({ foo: 'bar' }));
    client.onMessage?.('some/unknown/topic', payload);

    expect(useMqttStore.getState().willReceived).toBe(false);
    expect(useAlarmStore.getState().alarms).toHaveLength(0);
    expect(useDataStore.getState().samples).toHaveLength(0);
  });

  // ── RED 4: serverId 在消息上下文中传递 ──

  it('serverId 正确传递到消息上下文', async () => {
    const { setupRouter, onSysConnected, onSysDisconnected } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({ devices: [] });

    // 注册 $SYS 回调
    const connectedSpy = vi.fn();
    const disconnectedSpy = vi.fn();
    onSysConnected(connectedSpy);
    onSysDisconnected(disconnectedSpy);

    pool.create(makeServer({ id: 'server-a' }));
    pool.create(makeServer({ id: 'server-b' }));
    setupRouter(pool);

    // server-a 上发 connected 消息
    const clientA = spyFactory.clients[0];
    const payloadA = new TextEncoder().encode(JSON.stringify({
      connected: true, clientid: 'device-01',
    }));
    clientA.onMessage?.('$SYS/brokers/emqx/clients/device-01/connected', payloadA);

    expect(connectedSpy).toHaveBeenCalledWith('server-a', 'device-01', true);

    // server-b 上发 disconnected 消息
    const clientB = spyFactory.clients[1];
    const payloadB = new TextEncoder().encode(JSON.stringify({
      connected: false, clientid: 'device-02',
    }));
    clientB.onMessage?.('$SYS/brokers/emqx/clients/device-02/disconnected', payloadB);

    expect(disconnectedSpy).toHaveBeenCalledWith('server-b', 'device-02', false);
  });
});

// ── 辅助函数：创建一个待处理的 RPC ──

function createPendingRpc(): { corrId: string; rpcPromise: Promise<unknown> } {
  const corrId = `test-corr-${Math.random().toString(36).slice(2)}`;
  const rpcPromise = new Promise<unknown>((resolve) => {
    pendingRpcsForTest().set(corrId, {
      resolve: resolve as any,
      reject: () => {},
      timeout: setTimeout(() => {}, 99999),
      serverId: 'test-server',
    });
  });
  return { corrId, rpcPromise };
}
