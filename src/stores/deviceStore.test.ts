import { describe, it, expect, beforeEach } from 'vitest';
import { useDeviceStore } from './deviceStore';

function resetStore() {
  useDeviceStore.setState({
    devices: [],
    selectedId: null,
    searchText: '',
  });
}

describe('deviceStore.setOnline', () => {
  const deviceId = 'dev-1';

  beforeEach(() => {
    resetStore();
    useDeviceStore.getState().addDevice({
      id: deviceId,
      name: '测试设备',
      serverId: 'srv-1',
      isOnline: null,
    });
  });

  it('场景1: setOnline(id, true, "device_online") → isOnline=true, lastEventType="device_online"', () => {
    useDeviceStore.getState().setOnline(deviceId, true, 'device_online');

    const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
    expect(device?.isOnline).toBe(true);
    expect(device?.lastEventType).toBe('device_online');
  });

  it('场景2: setOnline(id, false, "device_offline") → isOnline=false, lastEventType="device_offline"', () => {
    useDeviceStore.getState().setOnline(deviceId, false, 'device_offline');

    const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
    expect(device?.isOnline).toBe(false);
    expect(device?.lastEventType).toBe('device_offline');
  });

  it('场景3: setOnline(id, false, "process_crashed") → isOnline=false, lastEventType="process_crashed"', () => {
    useDeviceStore.getState().setOnline(deviceId, false, 'process_crashed');

    const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
    expect(device?.isOnline).toBe(false);
    expect(device?.lastEventType).toBe('process_crashed');
  });

  it('场景4: setOnline(id, null) → isOnline=null, lastEventType=undefined', () => {
    // 先设一个值再清空
    useDeviceStore.getState().setOnline(deviceId, true, 'device_online');
    useDeviceStore.getState().setOnline(deviceId, null);

    const device = useDeviceStore.getState().devices.find((d) => d.id === deviceId);
    expect(device?.isOnline).toBeNull();
    expect(device?.lastEventType).toBeUndefined();
  });

  it('场景5: 不存在的设备ID → 设备列表不变', () => {
    const before = useDeviceStore.getState().devices;
    useDeviceStore.getState().setOnline('non-existent-id', true, 'device_online');

    const after = useDeviceStore.getState().devices;
    expect(after).toEqual(before);
  });
});
