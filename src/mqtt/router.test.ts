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
    id: 's1', name: 'test', brokerUrl: 'mqtt://localhost:1883',
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

  // ── events/will 上线 ──

  it('上线消息：setOnline + addOnlineClient + clearWill', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-01', name: 'd1', serverId: 's1', isOnline: null, lastEventType: undefined }],
    });
    useMqttStore.setState({ willReceived: true, willDeviceId: 'dev-01' });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const addOnlineSpy = vi.spyOn(pool, 'addOnlineClient');
    const clearWillSpy = vi.spyOn(useMqttStore.getState(), 'clearWill');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'online', ts: 1000, eventType: 'device_online',
      source: 'device', message: '设备上线', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/dev-01/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-01', true, 'device_online');
    expect(addOnlineSpy).toHaveBeenCalledWith('s1', 'dev-01');
    expect(clearWillSpy).toHaveBeenCalled();
  });

  it('正常下线：setOnline + removeOnlineClient', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-02', name: 'd2', serverId: 's1', isOnline: true, lastEventType: 'device_online' }],
    });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const removeOnlineSpy = vi.spyOn(pool, 'removeOnlineClient');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'offline', ts: 2000, eventType: 'device_offline',
      source: 'device', message: '设备下线', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/dev-02/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-02', false, 'device_offline');
    expect(removeOnlineSpy).toHaveBeenCalledWith('s1', 'dev-02');
  });

  it('崩溃：setOnline + setWill + removeOnlineClient', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-03', name: 'd3', serverId: 's1', isOnline: true, lastEventType: 'device_online' }],
    });
    useMqttStore.setState({ willReceived: false, willDeviceId: null });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const setWillSpy = vi.spyOn(useMqttStore.getState(), 'setWill');
    const removeOnlineSpy = vi.spyOn(pool, 'removeOnlineClient');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'offline', ts: 0, eventType: 'process_crashed',
      source: 'mqtt_broker', message: '进程崩溃', timestamp: '0001-01-01T00:00:00Z',
    }));
    client.onMessage?.('daq/dev-03/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-03', false, 'process_crashed');
    expect(setWillSpy).toHaveBeenCalledWith('dev-03');
    expect(removeOnlineSpy).toHaveBeenCalledWith('s1', 'dev-03');
  });

  it('陌生 MachineId：setOnline 不调用', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({ devices: [] });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const addOnlineSpy = vi.spyOn(pool, 'addOnlineClient');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'online', ts: 1000, eventType: 'device_online',
      source: 'device', message: '上线', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/unknown-dev/events/will', payload);

    expect(setOnlineSpy).not.toHaveBeenCalled();
    expect(addOnlineSpy).toHaveBeenCalledWith('s1', 'unknown-dev');
  });

  it('ts 幂等：新 ts ≤ 旧 ts → 跳过', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-05', name: 'd5', serverId: 's1', isOnline: true, lastEventType: 'device_online', lastTs: 2000 }],
    });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'online', ts: 500, eventType: 'device_online',
      source: 'device', message: '旧消息', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/dev-05/events/will', payload);

    expect(setOnlineSpy).not.toHaveBeenCalled();
  });

  it('ts 幂等：新 ts > 旧 ts → 执行更新', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-06', name: 'd6', serverId: 's1', isOnline: false, lastEventType: 'device_offline', lastTs: 1000 }],
    });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'online', ts: 2000, eventType: 'device_online',
      source: 'device', message: '新消息', timestamp: new Date().toISOString(),
    }));
    client.onMessage?.('daq/dev-06/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-06', true, 'device_online');
  });

  it('崩溃幂等：lastEventType 已是 process_crashed → 跳过', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-07', name: 'd7', serverId: 's1', isOnline: false, lastEventType: 'process_crashed' }],
    });
    useMqttStore.setState({ willReceived: true, willDeviceId: 'dev-07' });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const setWillSpy = vi.spyOn(useMqttStore.getState(), 'setWill');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'offline', ts: 0, eventType: 'process_crashed',
      source: 'mqtt_broker', message: '重复崩溃', timestamp: '0001-01-01T00:00:00Z',
    }));
    client.onMessage?.('daq/dev-07/events/will', payload);

    expect(setOnlineSpy).not.toHaveBeenCalled();
    expect(setWillSpy).not.toHaveBeenCalled();
  });

  it('崩溃幂等：lastEventType 非崩溃 → 执行更新', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-08', name: 'd8', serverId: 's1', isOnline: true, lastEventType: 'device_online' }],
    });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'offline', ts: 0, eventType: 'process_crashed',
      source: 'mqtt_broker', message: '崩溃', timestamp: '0001-01-01T00:00:00Z',
    }));
    client.onMessage?.('daq/dev-08/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-08', false, 'process_crashed');
  });

  it('崩溃本地时间：ts=0 也不阻塞', async () => {
    const { setupRouter } = await import('./router');
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { useMqttStore } = await import('../stores/mqttStore');

    useDeviceStore.setState({
      devices: [{ id: 'dev-09', name: 'd9', serverId: 's1', isOnline: true, lastEventType: 'device_online', lastTs: 5000 }],
    });
    useMqttStore.setState({ willReceived: false });

    const setOnlineSpy = vi.spyOn(useDeviceStore.getState(), 'setOnline');
    const setWillSpy = vi.spyOn(useMqttStore.getState(), 'setWill');

    pool.create(makeServer({ id: 's1' }));
    setupRouter(pool);

    const client = spyFactory.clients[0];
    const payload = new TextEncoder().encode(JSON.stringify({
      status: 'offline', ts: 0, eventType: 'process_crashed',
      source: 'mqtt_broker', message: '崩溃(ts=0)', timestamp: '0001-01-01T00:00:00Z',
    }));
    client.onMessage?.('daq/dev-09/events/will', payload);

    expect(setOnlineSpy).toHaveBeenCalledWith('dev-09', false, 'process_crashed');
    expect(setWillSpy).toHaveBeenCalledWith('dev-09');
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
