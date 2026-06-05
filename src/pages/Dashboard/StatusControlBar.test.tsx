import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const {
  deviceStoreState,
  mqttStoreState,
  collectorStoreState,
  laserStoreState,
} = vi.hoisted(() => {
  const deviceState = {
    devices: [] as { id: string; name: string; serverId: string; isOnline: boolean | null }[],
    selectedId: null as string | null,
  };
  const mqttState = {
    mqttConnected: false,
    willReceived: false,
    willDeviceId: null as string | null,
  };
  const collectorState = {
    processConnected: false,
    deviceOpened: false,
    acquiring: false,
    lastMessage: '',
    openButtonPhase: 'idle' as string,
    startButtonPhase: 'idle' as string,
  };
  const laserState = {
    serialConnected: false,
    emissionOn: false,
    portName: '',
    lastMessage: '',
    connectButtonPhase: 'idle' as string,
    laserButtonPhase: 'idle' as string,
  };
  return {
    deviceStoreState: deviceState,
    mqttStoreState: mqttState,
    collectorStoreState: collectorState,
    laserStoreState: laserState,
  };
});

vi.mock('../../stores/deviceStore', () => ({
  useDeviceStore: vi.fn((selector: (s: typeof deviceStoreState) => unknown) => {
    return selector ? selector(deviceStoreState) : deviceStoreState;
  }),
}));

vi.mock('../../stores/mqttStore', () => ({
  useMqttStore: vi.fn((selector: (s: typeof mqttStoreState) => unknown) => {
    return selector ? selector(mqttStoreState) : mqttStoreState;
  }),
}));

vi.mock('../../stores/collectorStore', () => ({
  useCollectorStore: vi.fn((selector: (s: typeof collectorStoreState) => unknown) => {
    return selector ? selector(collectorStoreState) : collectorStoreState;
  }),
}));

vi.mock('../../stores/laserStore', () => ({
  useLaserStore: vi.fn((selector: (s: typeof laserStoreState) => unknown) => {
    return selector ? selector(laserStoreState) : laserStoreState;
  }),
}));

const mockSendCommand = vi.fn().mockResolvedValue({
  success: true,
  code: 'OK',
  message: '',
  data: {},
  timestamp: '',
});

vi.mock('../../hooks/useRpcCommand', () => ({
  useRpcCommand: () => ({ sendCommand: mockSendCommand }),
}));

vi.mock('../../components/Clock', () => ({
  Clock: () => null,
}));

import { StatusControlBar } from './StatusControlBar';

function setNormalState() {
  deviceStoreState.devices = [
    { id: 'device-1', name: '测试设备', serverId: 'srv-1', isOnline: true },
  ];
  deviceStoreState.selectedId = 'device-1';

  mqttStoreState.mqttConnected = true;
  mqttStoreState.willReceived = false;
  mqttStoreState.willDeviceId = null;

  collectorStoreState.processConnected = true;
  collectorStoreState.deviceOpened = true;
  collectorStoreState.acquiring = false;
  collectorStoreState.openButtonPhase = 'idle';
  collectorStoreState.startButtonPhase = 'idle';

  laserStoreState.serialConnected = false;
  laserStoreState.emissionOn = false;
  laserStoreState.connectButtonPhase = 'idle';
  laserStoreState.laserButtonPhase = 'idle';
}

function resetState() {
  deviceStoreState.devices = [];
  deviceStoreState.selectedId = null;

  mqttStoreState.mqttConnected = false;
  mqttStoreState.willReceived = false;
  mqttStoreState.willDeviceId = null;

  collectorStoreState.processConnected = false;
  collectorStoreState.deviceOpened = false;
  collectorStoreState.acquiring = false;
  collectorStoreState.openButtonPhase = 'idle';
  collectorStoreState.startButtonPhase = 'idle';

  laserStoreState.serialConnected = false;
  laserStoreState.emissionOn = false;
  laserStoreState.connectButtonPhase = 'idle';
  laserStoreState.laserButtonPhase = 'idle';
}

describe('StatusControlBar — 设置参数按钮', () => {
  beforeEach(() => {
    resetState();
  });

  it('正常状态下 Row2 显示"设置参数"按钮', () => {
    setNormalState();
    render(<StatusControlBar />);
    expect(screen.getByRole('button', { name: /设置参数/ })).toBeInTheDocument();
  });

  it('MQTT 断开时按钮 disabled', () => {
    setNormalState();
    mqttStoreState.mqttConnected = false;
    render(<StatusControlBar />);
    const btn = screen.getByRole('button', { name: /设置参数/ });
    expect(btn).toBeDisabled();
  });

  it('无选中设备时按钮 disabled', () => {
    setNormalState();
    deviceStoreState.selectedId = null;
    render(<StatusControlBar />);
    const btn = screen.getByRole('button', { name: /设置参数/ });
    expect(btn).toBeDisabled();
  });

  it('will 报文到达时按钮 disabled', () => {
    setNormalState();
    mqttStoreState.willReceived = true;
    render(<StatusControlBar />);
    const btn = screen.getByRole('button', { name: /设置参数/ });
    expect(btn).toBeDisabled();
  });

  it('processConnected 为 false 时按钮不因此 disabled', () => {
    setNormalState();
    collectorStoreState.processConnected = false;
    render(<StatusControlBar />);
    const btn = screen.getByRole('button', { name: /设置参数/ });
    expect(btn).not.toBeDisabled();
  });

  it('点击按钮弹出 ConfigModal，标题为"设备参数配置"', async () => {
    setNormalState();
    render(<StatusControlBar />);

    const btn = screen.getByRole('button', { name: /设置参数/ });
    fireEvent.click(btn);

    expect(screen.getByText('设备参数配置')).toBeInTheDocument();
  });

  it('点击设置参数按钮后，Modal 四标签"采集卡、激光雷达、算法参数、持久化"存在', async () => {
    setNormalState();
    render(<StatusControlBar />);

    const btn = screen.getByRole('button', { name: /设置参数/ });
    await userEvent.click(btn);

    // "采集卡" 同时出现在 StatusControlBar 标签和 Modal Tab 中
    expect(screen.getAllByText('采集卡').length).toBe(2);
    expect(screen.getByText('激光雷达')).toBeInTheDocument();
    expect(screen.getByText('算法参数')).toBeInTheDocument();
    expect(screen.getByText('持久化')).toBeInTheDocument();
  });
});
