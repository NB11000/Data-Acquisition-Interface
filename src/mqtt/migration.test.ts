import { describe, it, expect, beforeEach } from 'vitest';
import { runMigration } from './migration';
import type { LegacyDevice } from './types';

function mockLocalStorage(store: Record<string, string> = {}) {
  const storage: Record<string, string> = { ...store };
  const getItem = (key: string) => {
    const val = storage[key];
    return val !== undefined ? val : null;
  };
  const setItem = (key: string, value: string) => {
    storage[key] = value;
  };
  const removeItem = (key: string) => {
    delete storage[key];
  };
  return { getItem, setItem, removeItem, _dump: () => ({ ...storage }) };
}

describe('runMigration', () => {
  let storage: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    storage = mockLocalStorage();
    globalThis.localStorage = storage as unknown as Storage;
  });

  const legacyDevices: LegacyDevice[] = [
    {
      id: 'daq-01',
      name: '一号采集节点',
      brokerUrl: 'mqtts://broker1.example.com:8883',
      port: 8883,
      username: 'user1',
      password: 'pass1',
      tls: true,
      isOnline: true,
    },
    {
      id: 'daq-02',
      name: '二号采集节点',
      brokerUrl: 'mqtts://broker1.example.com:8883',
      port: 8883,
      username: 'user1',
      password: 'pass1',
      tls: true,
      isOnline: false,
    },
    {
      id: 'daq-03',
      name: '三号采集节点',
      brokerUrl: 'mqtts://broker2.example.com:1883',
      port: 1883,
      username: 'user2',
      password: 'pass2',
      tls: false,
      isOnline: true,
    },
  ];

  it('旧格式数据迁移到新格式，返回 true', () => {
    storage.setItem('devices', JSON.stringify(legacyDevices));

    const result = runMigration();

    expect(result).toBe(true);

    const newDevices = JSON.parse(storage.getItem('devices')!);
    expect(newDevices).toHaveLength(3);
    expect(newDevices[0]).toEqual({ id: 'daq-01', name: '一号采集节点', serverId: expect.any(String), isOnline: true });
    expect(newDevices[1]).toEqual({ id: 'daq-02', name: '二号采集节点', serverId: expect.any(String), isOnline: false });
    expect(newDevices[2]).toEqual({ id: 'daq-03', name: '三号采集节点', serverId: expect.any(String), isOnline: true });

    const servers = JSON.parse(storage.getItem('mqttServers')!);
    expect(servers).toHaveLength(2);
    expect(servers[0]).toMatchObject({
      name: '默认服务器 1',
      brokerUrl: 'mqtts://broker1.example.com:8883',
      port: 8883,
      username: 'user1',
      password: 'pass1',
      tls: true,
      connected: false,
    });
    expect(servers[1]).toMatchObject({
      name: '默认服务器 2',
      brokerUrl: 'mqtts://broker2.example.com:1883',
      port: 1883,
      username: 'user2',
      password: 'pass2',
      tls: false,
      connected: false,
    });
  });

  it('device.serverId 应指向对应 server 的 id', () => {
    storage.setItem('devices', JSON.stringify(legacyDevices));

    runMigration();

    const servers = JSON.parse(storage.getItem('mqttServers')!);
    const newDevices = JSON.parse(storage.getItem('devices')!);

    const broker1Server = servers.find((s: any) => s.brokerUrl === 'mqtts://broker1.example.com:8883');
    const broker2Server = servers.find((s: any) => s.brokerUrl === 'mqtts://broker2.example.com:1883');

    expect(newDevices[0].serverId).toBe(broker1Server.id);
    expect(newDevices[1].serverId).toBe(broker1Server.id);
    expect(newDevices[2].serverId).toBe(broker2Server.id);
  });

  it('幂等：二次调用不重复迁移，返回 false', () => {
    storage.setItem('devices', JSON.stringify(legacyDevices));

    const first = runMigration();
    expect(first).toBe(true);

    const firstServers = storage.getItem('mqttServers')!;
    const firstDevices = storage.getItem('devices')!;

    const second = runMigration();
    expect(second).toBe(false);

    expect(storage.getItem('mqttServers')).toBe(firstServers);
    expect(storage.getItem('devices')).toBe(firstDevices);
  });

  it('旧 key 为空数组时不迁移，返回 false', () => {
    storage.setItem('devices', '[]');

    const result = runMigration();

    expect(result).toBe(false);
    expect(storage.getItem('mqttServers')).toBe(null);
  });

  it('旧 key 不存在时不迁移，返回 false', () => {
    const result = runMigration();

    expect(result).toBe(false);
  });

  it('旧 key 已损坏时安全降级，返回 false', () => {
    storage.setItem('devices', 'not valid json {{{');

    const result = runMigration();

    expect(result).toBe(false);
  });

  it('旧数据中不包含 brokerUrl 字段时跳过迁移，返回 false', () => {
    storage.setItem('devices', JSON.stringify([{ id: 'x', name: '无连接字段的设备' }]));

    const result = runMigration();

    expect(result).toBe(false);
    expect(storage.getItem('mqttServers')).toBe(null);
  });

  it('new key 已存在时不覆盖，返回 false', () => {
    storage.setItem('devices', JSON.stringify(legacyDevices));
    storage.setItem('mqttServers', '[{"id":"existing"}]');

    const result = runMigration();

    expect(result).toBe(false);
    expect(storage.getItem('mqttServers')).toBe('[{"id":"existing"}]');
  });
});
