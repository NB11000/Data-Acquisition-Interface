import { describe, it, expect, vi } from 'vitest';
import { MockMqttClient } from './mockClient';

describe('MockMqttClient', () => {
  it('subscribe 注册 handler, publish 触发匹配 topic 的 handler', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('test/topic');
    client.publish('test/topic', 'hello');

    expect(handler).toHaveBeenCalledWith('test/topic', expect.any(Uint8Array));
  });

  it('+ 通配符匹配单层 topic', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('daq/+/events/will');
    client.publish('daq/srv-01/events/will', 'data');

    expect(handler).toHaveBeenCalledWith('daq/srv-01/events/will', expect.any(Uint8Array));
  });

  it('# 通配符匹配多层 topic', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('daq/srv-01/#');
    client.publish('daq/srv-01/waveform/ch1', 'data');

    expect(handler).toHaveBeenCalledWith('daq/srv-01/waveform/ch1', expect.any(Uint8Array));
  });

  it('end 清理所有订阅', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('test/topic');
    client.end();
    client.publish('test/topic', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });

  it('end 后 isConnected 为 false', () => {
    const client = new MockMqttClient('test-client');

    client.connect();
    expect(client.isConnected).toBe(true);

    client.end();
    expect(client.isConnected).toBe(false);
  });

  it('# 通配符匹配自身层级', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('daq/srv-01/#');
    client.publish('daq/srv-01', 'data');

    expect(handler).toHaveBeenCalledWith('daq/srv-01', expect.any(Uint8Array));
  });

  it('+ 通配符不匹配跨层 topic', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('daq/+/events/will');
    client.publish('daq/srv-01/internal/events/will', 'data');

    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribe 移除 handler, publish 不再触发', () => {
    const client = new MockMqttClient('test-client');
    const handler = vi.fn();
    client.onMessage = handler;

    client.connect();
    client.subscribe('test/topic');
    client.unsubscribe('test/topic');
    client.publish('test/topic', 'hello');

    expect(handler).not.toHaveBeenCalled();
  });
});
