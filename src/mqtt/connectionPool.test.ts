import { describe, it, expect, vi } from 'vitest';
import { MockMqttClient } from './mockClient';
import type { MqttClientLike } from './mqttClientLike';
import type { ConnectionFactory } from './connectionFactory';
import type { MqttServer } from '../stores/serverStore';

function createMockFactory(): ConnectionFactory {
  return {
    createConnection(server: MqttServer): MqttClientLike {
      return new MockMqttClient(server.id);
    },
  };
}

interface SpyConnectionFactory extends ConnectionFactory {
  clients: MockMqttClient[];
}

function createSpyFactory(): SpyConnectionFactory {
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

const server = (overrides: Partial<MqttServer> = {}): MqttServer => ({
  id: 's1', name: 'test', brokerUrl: 'mqtt://localhost', port: 1883,
  username: '', password: '', tls: false, connected: false,
  ...overrides,
});

describe('ConnectionPool', () => {
  it('create server → client isConnected 为 true, 状态为 connected', async () => {
    const { ConnectionPool } = await import('./connectionPool');
    const pool = new ConnectionPool(createMockFactory());

    pool.create(server());

    expect(pool.isConnected('s1')).toBe(true);
    expect(pool.getState('s1')).toBe('connected');
  });

  it('destroy → client 断开, 状态清空', async () => {
    const { ConnectionPool } = await import('./connectionPool');
    const pool = new ConnectionPool(createMockFactory());

    pool.create(server());
    pool.destroy('s1');

    expect(pool.isConnected('s1')).toBe(false);
    expect(pool.getState('s1')).toBe('disconnected');
  });

  it('subscribeDevice → 订阅 4 个常驻主题', async () => {
    const { ConnectionPool } = await import('./connectionPool');
    const spyFactory = createSpyFactory();
    const pool = new ConnectionPool(spyFactory);

    pool.create(server());
    const client = spyFactory.clients[0];
    const subscribeSpy = vi.spyOn(client, 'subscribe');

    pool.subscribeDevice('s1', 'machine-01');

    expect(subscribeSpy).toHaveBeenCalledWith('daq/machine-01/events/will');
    expect(subscribeSpy).toHaveBeenCalledWith('daq/machine-01/events/state_changed');
    expect(subscribeSpy).toHaveBeenCalledWith('daq/machine-01/events/device_alarm');
    expect(subscribeSpy).toHaveBeenCalledWith('$rpc/machine-01/+/+/response');
    expect(subscribeSpy).toHaveBeenCalledTimes(4);
  });

  it('update 仅变更 name → 不触发重连', async () => {
    const { ConnectionPool } = await import('./connectionPool');
    const spyFactory = createSpyFactory();
    const pool = new ConnectionPool(spyFactory);

    pool.create(server({ name: 'old-name' }));
    const client = spyFactory.clients[0];
    const endSpy = vi.spyOn(client, 'end');

    pool.update(server({ name: 'new-name' }));

    expect(endSpy).not.toHaveBeenCalled();
    expect(pool.isConnected('s1')).toBe(true);
  });

  it('自动重连: 1s→2s→4s, 3次重试后 failed', async () => {
    vi.useFakeTimers();

    const { ConnectionPool } = await import('./connectionPool');
    const spyFactory = createSpyFactory();
    const pool = new ConnectionPool(spyFactory);

    pool.create(server());
    const client = spyFactory.clients[0];

    vi.spyOn(client, 'connect').mockImplementation(() => {});
    Object.defineProperty(client, 'isConnected', {
      get: () => false,
      configurable: true,
    });

    client.onDisconnect?.();

    expect(pool.getState('s1')).toBe('reconnecting');

    vi.advanceTimersByTime(1000);
    expect(pool.getState('s1')).toBe('reconnecting');

    vi.advanceTimersByTime(2000);
    expect(pool.getState('s1')).toBe('reconnecting');

    vi.advanceTimersByTime(4000);
    expect(pool.getState('s1')).toBe('failed');

    vi.useRealTimers();
  });

  it('空服务器（无 device）→ 断开连接释放资源', async () => {
    const { ConnectionPool } = await import('./connectionPool');
    const spyFactory = createSpyFactory();
    const pool = new ConnectionPool(spyFactory);

    pool.create(server());
    pool.subscribeDevice('s1', 'machine-01');
    const client = spyFactory.clients[0];
    const endSpy = vi.spyOn(client, 'end');

    pool.unsubscribeDevice('s1', 'machine-01');

    expect(endSpy).toHaveBeenCalled();
    expect(pool.isConnected('s1')).toBe(false);
  });
});
