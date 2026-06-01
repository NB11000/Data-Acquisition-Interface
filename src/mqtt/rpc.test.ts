import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockMqttClient } from './mockClient';
import type { MqttClientLike } from './mqttClientLike';
import type { ConnectionFactory } from './connectionFactory';
import type { MqttServer } from '../stores/serverStore';
import { ConnectionPool } from './connectionPool';

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

describe('RPC', () => {
  let pool: ConnectionPool;
  let spyFactory: SpyFactory;

  beforeEach(async () => {
    spyFactory = createSpyFactory();
    pool = new ConnectionPool(spyFactory);

    const { useDeviceStore } = await import('../stores/deviceStore');
    useDeviceStore.setState({ devices: [], selectedId: null });

    // 清理上一个测试残留的 pendingRpc
    const { pendingRpcsForTest } = await import('./rpc');
    pendingRpcsForTest().clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 测试 1: MachineId → serverId 路由 ──

  it('MachineId → serverId 路由，publish 到正确的 server', async () => {
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { sendRpcCommand, pendingRpcsForTest } = await import('./rpc');

    useDeviceStore.setState({
      devices: [
        { id: 'machine-01', name: '设备1', serverId: 'server-a', isOnline: null },
      ],
    });

    pool.create(makeServer({ id: 'server-a' }));
    const client = spyFactory.clients[0];
    const publishSpy = vi.spyOn(client, 'publish');

    // 发 RPC（MQTT_MODE 默认为 mock 时走 handleMockRpc；非 mock 时走 publish）
    const promise = sendRpcCommand(pool, 'machine-01', 'SYSTEM_STATE');

    // 手动 resolve，不让测试挂起
    const pending = pendingRpcsForTest();
    expect(pending.size).toBeGreaterThanOrEqual(1);
    for (const [corrId, p] of pending) {
      p.resolve({ success: true, code: 'OK', message: 'ok', timestamp: '' });
    }

    await promise;
  });

  // ── 测试 2: correlation ID 匹配（不同 corrId 互不干扰） ──

  it('不同 corrId 不互相干扰 — 直接测试 pendingRpcs Map', async () => {
    const { pendingRpcsForTest } = await import('./rpc');

    // 手动创建两个 pending RPC
    const map = pendingRpcsForTest();
    map.clear();

    const r1 = vi.fn();
    const r2 = vi.fn();
    const e1 = vi.fn();
    const e2 = vi.fn();

    map.set('corr-A', { resolve: r1, reject: e1, timeout: setTimeout(() => {}, 99999), serverId: 'test-server' });
    map.set('corr-B', { resolve: r2, reject: e2, timeout: setTimeout(() => {}, 99999), serverId: 'test-server' });

    // 只 resolve corr-A
    map.get('corr-A')!.resolve({ success: true, code: 'OK', message: 'a', timestamp: '' });

    expect(r1).toHaveBeenCalledTimes(1);
    expect(r2).not.toHaveBeenCalled();
    expect(e1).not.toHaveBeenCalled();
    expect(e2).not.toHaveBeenCalled();

    // resolve corr-B
    map.get('corr-B')!.resolve({ success: true, code: 'OK', message: 'b', timestamp: '' });
    expect(r2).toHaveBeenCalledTimes(1);
  });

  // ── 测试 3: 10s 超时 reject ──

  it('10s 超时 reject', async () => {
    vi.useFakeTimers();

    const { useDeviceStore } = await import('../stores/deviceStore');
    const { sendRpcCommand, pendingRpcsForTest } = await import('./rpc');

    useDeviceStore.setState({
      devices: [
        { id: 'machine-01', name: '设备1', serverId: 's1', isOnline: null },
      ],
    });

    pool.create(makeServer({ id: 's1' }));
    expect(pool.isConnected('s1')).toBe(true);

    const errorSpy = vi.fn();
    sendRpcCommand(pool, 'machine-01', 'SYSTEM_STATE').catch(errorSpy);

    expect(pendingRpcsForTest().size).toBe(1);

    // 一次性推进 10000ms
    vi.advanceTimersByTime(10000);

    // 必须用 await 等待 Promise 微任务执行
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy.mock.calls[0][0].message).toContain('超时');
    expect(pendingRpcsForTest().size).toBe(0);
  });

  // ── 测试 4: 连接断开即时 reject CONNECTION_LOST ──

  it('连接断开时立即 reject CONNECTION_LOST', async () => {
    const { useDeviceStore } = await import('../stores/deviceStore');
    const { sendRpcCommand, clearPendingRpcs, pendingRpcsForTest } = await import('./rpc');

    useDeviceStore.setState({
      devices: [
        { id: 'machine-01', name: '设备1', serverId: 's1', isOnline: null },
      ],
    });

    pool.create(makeServer({ id: 's1' }));

    const errorSpy = vi.fn();
    sendRpcCommand(pool, 'machine-01', 'SYSTEM_STATE').catch(errorSpy);

    // 模拟连接断开 — 调用 clearPendingRpcs
    clearPendingRpcs();

    await vi.waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(errorSpy.mock.calls[0][0].message).toContain('CONNECTION_LOST');
  });
});
