import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// ── 用 vi.hoisted 提升 mock 变量，避免 TDZ ──
const {
  mockSendRpcCommand,
  mockClearPendingRpcs,
  mockSetupRouterTeardown,
  mockPool,
  mockCollectorReset,
  mockCollectorApplyState,
  mockLaserReset,
  mockLaserApplyState,
  mockWaveformClear,
  mockDataClear,
  mockAlarmClear,
} = vi.hoisted(() => {
  const p = {
    subscribeDevice: vi.fn(),
    switchFollowing: vi.fn(),
    unsubscribeDevice: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    onStateChange: vi.fn(),
    offStateChange: vi.fn(),
    create: vi.fn(),
    getClient: vi.fn().mockReturnValue(null),
    publish: vi.fn(),
  };

  return {
    mockSendRpcCommand: vi.fn().mockResolvedValue({
      success: true,
      code: 'OK',
      message: '',
      state: {
        collector: { processConnected: true, deviceOpened: false, acquiring: false },
        laser: { serialConnected: false, emissionOn: false },
      },
      timestamp: new Date().toISOString(),
    }),
    mockClearPendingRpcs: vi.fn(),
    mockSetupRouterTeardown: vi.fn(),
    mockPool: p,
    mockCollectorReset: vi.fn(),
    mockCollectorApplyState: vi.fn(),
    mockLaserReset: vi.fn(),
    mockLaserApplyState: vi.fn(),
    mockWaveformClear: vi.fn(),
    mockDataClear: vi.fn(),
    mockAlarmClear: vi.fn(),
  };
});

// ── 模块级 mock 状态（每个 store 的可变状态） ──
const { _deviceState, _serverState, _mqttState } = vi.hoisted(() => {
  const state = {
    _deviceState: {} as Record<string, unknown>,
    _serverState: {} as Record<string, unknown>,
    _mqttState: {} as Record<string, unknown>,
  };
  return state;
});

// ── zustand store 简易 mock：可作 hook 也可 getState ──
function storeMock(getStateFn: () => Record<string, unknown>) {
  return Object.assign(
    (selector?: (s: any) => any) =>
      selector ? selector(getStateFn()) : getStateFn(),
    { getState: getStateFn },
  );
}

vi.mock('../mqtt/pool', () => ({ getPool: () => mockPool }));

vi.mock('../mqtt/rpc', () => ({
  sendRpcCommand: mockSendRpcCommand,
  clearPendingRpcs: mockClearPendingRpcs,
  tryResolveRpc: vi.fn(() => false),
}));

vi.mock('../mqtt/router', () => ({
  setupRouter: vi.fn(() => mockSetupRouterTeardown),
}));

vi.mock('./useMockGenerators', () => ({
  useMockGenerators: vi.fn(),
}));

vi.mock('../env', () => ({ MQTT_MODE: 'real' }));

vi.mock('../stores/deviceStore', () => ({
  useDeviceStore: storeMock(() => _deviceState),
}));

vi.mock('../stores/serverStore', () => ({
  useServerStore: storeMock(() => _serverState),
}));

vi.mock('../stores/mqttStore', () => ({
  useMqttStore: storeMock(() => _mqttState),
}));

vi.mock('../stores/collectorStore', () => ({
  useCollectorStore: storeMock(() => ({
    reset: mockCollectorReset,
    applyState: mockCollectorApplyState,
  })),
}));

vi.mock('../stores/laserStore', () => ({
  useLaserStore: storeMock(() => ({
    reset: mockLaserReset,
    applyState: mockLaserApplyState,
  })),
}));

vi.mock('../stores/waveformStore', () => ({
  useWaveformStore: storeMock(() => ({ clear: mockWaveformClear })),
}));

vi.mock('../stores/dataStore', () => ({
  useDataStore: storeMock(() => ({ clear: mockDataClear })),
}));

vi.mock('../stores/alarmStore', () => ({
  useAlarmStore: storeMock(() => ({ clear: mockAlarmClear })),
}));

import { useMqttConnect } from './useMqttConnect';

describe('useMqttConnect — 设备切换 Effect', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    Object.assign(_deviceState, {
      devices: [
        { id: 'dev-1', name: '在线设备', serverId: 'srv-1', isOnline: true },
        { id: 'dev-2', name: '离线设备', serverId: 'srv-1', isOnline: false },
        { id: 'dev-3', name: '未知状态', serverId: 'srv-1', isOnline: null },
      ],
      selectedId: null,
      searchText: '',
    });

    Object.assign(_serverState, {
      servers: [],
      setConnected: vi.fn(),
      setConnectionState: vi.fn(),
    });

    Object.assign(_mqttState, {
      mqttConnected: false,
      setConnected: vi.fn(),
    });
  });

  function selectAndRerender(id: string, rerender: () => void) {
    (_deviceState as Record<string, unknown>).selectedId = id;
    rerender();
  }

  it('在线设备切换时应触发 RPC (method=system-state)', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    selectAndRerender('dev-1', rerender);

    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineId, method] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineId).toBe('dev-1');
    expect(method).toBe('system-state');
  });

  it('离线设备切换时应跳过 RPC', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    selectAndRerender('dev-2', rerender);

    expect(mockSendRpcCommand).not.toHaveBeenCalled();
  });

  it('isOnline=null 时应跳过 RPC', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    selectAndRerender('dev-3', rerender);

    expect(mockSendRpcCommand).not.toHaveBeenCalled();
  });

  // ── ISSUE-002: isOnline 变化监听 ──

  it('isOnline false→true 触发补发 RPC', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    // 选中离线设备，离线时跳过 RPC
    selectAndRerender('dev-2', rerender);
    expect(mockSendRpcCommand).not.toHaveBeenCalled();

    // 设备上线
    const devices = (_deviceState as Record<string, unknown>).devices as Array<Record<string, unknown>>;
    const dev = devices.find(d => d.id === 'dev-2')!;
    dev.isOnline = true;
    rerender();

    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineId, method] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineId).toBe('dev-2');
    expect(method).toBe('system-state');
  });

  it('isOnline true→true 不触发', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    // 选中在线设备（isOnline=true），会触发生效（切换 + 上线两段都可能触发）
    selectAndRerender('dev-1', rerender);
    vi.clearAllMocks();

    // 再次 rerender，selectedId 与 isOnline 均不变
    rerender();

    expect(mockSendRpcCommand).not.toHaveBeenCalled();
  });

  it('isOnline null→true 触发补发', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    // 选中 isOnline=null 的未知设备
    selectAndRerender('dev-3', rerender);
    vi.clearAllMocks();

    // 设备上线
    const devices = (_deviceState as Record<string, unknown>).devices as Array<Record<string, unknown>>;
    const dev = devices.find(d => d.id === 'dev-3')!;
    dev.isOnline = true;
    rerender();

    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineId, method] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineId).toBe('dev-3');
    expect(method).toBe('system-state');
  });

  it('selectedId 变化重置 ref，设备B上线用B的 machineId', () => {
    const { rerender } = renderHook(() => useMqttConnect());

    // 设备A (dev-2) 从离线变在线
    selectAndRerender('dev-2', rerender);
    const devices = (_deviceState as Record<string, unknown>).devices as Array<Record<string, unknown>>;
    let devA = devices.find(d => d.id === 'dev-2')!;
    devA.isOnline = true;
    rerender();
    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineIdA] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineIdA).toBe('dev-2');

    vi.clearAllMocks();

    // 切换到设备B (dev-3)，此时 isOnline=null
    selectAndRerender('dev-3', rerender);
    vi.clearAllMocks();

    // 设备B 上线
    let devB = devices.find(d => d.id === 'dev-3')!;
    devB.isOnline = true;
    rerender();

    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineIdB] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineIdB).toBe('dev-3');
  });

  // ── ISSUE-003: MQTT 重连/StrictMode 兜底增加 isOnline 门控 ──

  it('重连路径：isOnline=true 时发 RPC', () => {
    _deviceState.selectedId = 'dev-1';
    _serverState.servers = [{ id: 'srv-1' }];

    renderHook(() => useMqttConnect());

    // 捕获 onStateChange 回调
    const onStateChange = mockPool.onStateChange.mock.calls[0][0] as (arg: { serverId: string; state: string }) => void;

    // 清除初始 Effect 产生的调用
    vi.clearAllMocks();

    // 模拟 MQTT 重连
    onStateChange({ serverId: 'srv-1', state: 'connected' });

    expect(mockSendRpcCommand).toHaveBeenCalled();
    const [, machineId, method] = mockSendRpcCommand.mock.calls[0] as unknown[];
    expect(machineId).toBe('dev-1');
    expect(method).toBe('system-state');
  });

  it('重连路径：isOnline=false 时跳过 RPC', () => {
    _deviceState.selectedId = 'dev-2';
    _serverState.servers = [{ id: 'srv-1' }];

    renderHook(() => useMqttConnect());

    // 必须在 clearAllMocks 前捕获 onStateChange 回调
    const onStateChange = mockPool.onStateChange.mock.calls[0][0] as (arg: { serverId: string; state: string }) => void;

    // StrictMode 兜底路径也不应触发 RPC（已加 isOnline 门控）
    expect(mockSendRpcCommand).not.toHaveBeenCalled();

    vi.clearAllMocks();

    onStateChange({ serverId: 'srv-1', state: 'connected' });

    expect(mockSendRpcCommand).not.toHaveBeenCalled();
  });

  it('StrictMode兜底路径：isOnline=false 时跳过 RPC', () => {
    _deviceState.selectedId = 'dev-2';
    _serverState.servers = [{ id: 'srv-1' }];

    renderHook(() => useMqttConnect());

    // StrictMode 兜底路径不应为离线设备发 RPC
    expect(mockSendRpcCommand).not.toHaveBeenCalled();
  });
});
