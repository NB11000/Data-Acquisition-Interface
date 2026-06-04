import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type {
  CaptureCardConfig,
  RadarConfig,
  LidarAlgorithmConfig,
  PersistenceSettings,
} from './ConfigModal';
import {
  SYNC_CHANNEL_OPTIONS,
  CLOCK_SOURCE_OPTIONS,
  HALF_FULL_OPTIONS,
  TRIGGER_SOURCE_OPTIONS,
  RANGE_OPTIONS,
  BAUD_RATE_OPTIONS,
  ConfigModal,
} from './ConfigModal';
import { useRpcCommand } from '../../../hooks/useRpcCommand';
import { message } from 'antd';

const { mockMessageSuccess, mockMessageError } = vi.hoisted(() => ({
  mockMessageSuccess: vi.fn(),
  mockMessageError: vi.fn(),
}));

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      ...actual.message,
      success: mockMessageSuccess,
      error: mockMessageError,
    },
  };
});

describe('ConfigModal 类型定义', () => {
  it('CaptureCardConfig 可被正确 import 并使用', () => {
    const config: CaptureCardConfig = {
      deviceId: 0,
      syncChannelIndex: 1,
      sampleRate: 1000,
      clockSourceIndex: 0,
      halfFullThreshold: 4,
      triggerSourceIndex: 1,
      rangeIndex: 0,
    };
    expect(config.deviceId).toBe(0);
    expect(config.syncChannelIndex).toBe(1);
  });

  it('RadarConfig 可被正确 import 并使用', () => {
    const config: RadarConfig = {
      laserPower: 100,
      laserModulationFrequency: 50,
      serialPort: 'COM1',
      baudRate: 115200,
    };
    expect(config.laserPower).toBe(100);
    expect(config.baudRate).toBe(115200);
  });

  it('LidarAlgorithmConfig 可被正确 import 并使用', () => {
    const config: LidarAlgorithmConfig = {
      gainEqualizationCoefficient: 1.0,
      kConstant: 0.5,
      receiverApertureD_m: 0.1,
      pathLengthL_m: 1000,
      cn2WindowFrames: 10,
      fernaldBoundaryDistance_m: 5000,
      laserWavelength_nm: 532,
      angstromExponent: 1.3,
      darkCurrentSampleCount: 100,
      sampleRateHz: 1000,
      blindZoneDistance_m: 30,
    };
    expect(config.laserWavelength_nm).toBe(532);
    expect(config.blindZoneDistance_m).toBe(30);
  });

  it('PersistenceSettings 可被正确 import 并使用', () => {
    const settings: PersistenceSettings = {
      dataDirectory: '/data/lidar',
    };
    expect(settings.dataDirectory).toBe('/data/lidar');
  });
});

describe('ConfigModal 下拉选项常量', () => {
  /** 校验每个 option 含 label: string 和 value: number */
  const validateOptions = (
    name: string,
    options: readonly { label: string; value: number }[],
    expectedCount: number,
  ) => {
    expect(options, `${name} 应有 ${expectedCount} 项`).toHaveLength(expectedCount);
    options.forEach((opt, i) => {
      expect(opt, `${name}[${i}] 应包含 label`).toHaveProperty('label');
      expect(typeof opt.label, `${name}[${i}].label 应为 string`).toBe('string');
      expect(opt, `${name}[${i}] 应包含 value`).toHaveProperty('value');
      expect(typeof opt.value, `${name}[${i}].value 应为 number`).toBe('number');
    });
  };

  it('SYNC_CHANNEL_OPTIONS 格式正确', () => {
    validateOptions('SYNC_CHANNEL_OPTIONS', SYNC_CHANNEL_OPTIONS, 3);
  });

  it('CLOCK_SOURCE_OPTIONS 格式正确', () => {
    validateOptions('CLOCK_SOURCE_OPTIONS', CLOCK_SOURCE_OPTIONS, 2);
  });

  it('HALF_FULL_OPTIONS 格式正确', () => {
    validateOptions('HALF_FULL_OPTIONS', HALF_FULL_OPTIONS, 8);
  });

  it('TRIGGER_SOURCE_OPTIONS 格式正确', () => {
    validateOptions('TRIGGER_SOURCE_OPTIONS', TRIGGER_SOURCE_OPTIONS, 2);
  });

  it('RANGE_OPTIONS 格式正确', () => {
    validateOptions('RANGE_OPTIONS', RANGE_OPTIONS, 2);
  });

  it('BAUD_RATE_OPTIONS 格式正确', () => {
    validateOptions('BAUD_RATE_OPTIONS', BAUD_RATE_OPTIONS, 8);
  });
});

describe('ConfigModal 组件', () => {
  it('open=true 时 Modal 可见，标题为"设备参数配置"', () => {
    render(<ConfigModal open onClose={vi.fn()} />);
    expect(screen.getByText('设备参数配置')).toBeInTheDocument();
  });

  it('四个 Tab 标签存在：采集卡、激光雷达、算法参数、持久化', () => {
    render(<ConfigModal open onClose={vi.fn()} />);
    expect(screen.getByText('采集卡')).toBeInTheDocument();
    expect(screen.getByText('激光雷达')).toBeInTheDocument();
    expect(screen.getByText('算法参数')).toBeInTheDocument();
    expect(screen.getByText('持久化')).toBeInTheDocument();
  });

  it('open=false 时 Modal 不渲染', () => {
    render(<ConfigModal open={false} onClose={vi.fn()} />);
    expect(screen.queryByText('设备参数配置')).not.toBeInTheDocument();
  });

  it('点击遮罩层触发 onClose 回调', () => {
    const onClose = vi.fn();
    render(<ConfigModal open onClose={onClose} />);
    const wrap = document.querySelector('.ant-modal-wrap') as HTMLElement;
    if (wrap) {
      fireEvent.mouseDown(wrap);
      fireEvent.click(wrap);
    }
    expect(onClose).toHaveBeenCalled();
  });

  it('点击 X 按钮触发 onClose 回调', () => {
    const onClose = vi.fn();
    render(<ConfigModal open onClose={onClose} />);
    const closeBtn = document.querySelector('.ant-modal-close') as HTMLElement;
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});

// ── 配置读取 mock ──

const mockSendCommand = vi.fn();

vi.mock('../../../hooks/useRpcCommand', () => ({
  useRpcCommand: () => ({ sendCommand: mockSendCommand }),
}));

const collectorData: CaptureCardConfig = {
  deviceId: 0, syncChannelIndex: 2, sampleRate: 1000,
  clockSourceIndex: 0, halfFullThreshold: 5, triggerSourceIndex: 1, rangeIndex: 0,
};

const laserData: RadarConfig = {
  laserPower: 100, laserModulationFrequency: 1000, serialPort: 'COM3', baudRate: 9600,
};

const algorithmData: LidarAlgorithmConfig = {
  gainEqualizationCoefficient: 1.0, kConstant: 4.48, receiverApertureD_m: 0.2,
  pathLengthL_m: 1000.0, cn2WindowFrames: 100, fernaldBoundaryDistance_m: 3000.0,
  laserWavelength_nm: 532.0, angstromExponent: 1.3, darkCurrentSampleCount: 0,
  sampleRateHz: 20000000.0, blindZoneDistance_m: 30.0,
};

const persistenceData: PersistenceSettings = {
  dataDirectory: 'data',
};

function mockAllSuccess() {
  mockSendCommand.mockImplementation(async (method: string) => {
    switch (method) {
      case 'collector-config-read':
        return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
      case 'laser-config-read':
        return { success: true, code: 'OK', message: '', data: laserData, timestamp: '' };
      case 'lidar-config-read':
        return { success: true, code: 'OK', message: '', data: algorithmData, timestamp: '' };
      case 'persistence-config-read':
        return { success: true, code: 'OK', message: '', data: persistenceData, timestamp: '' };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  });
}

function mockAllFail() {
  mockSendCommand.mockRejectedValue(new Error('RPC 超时'));
}

function mockPartialFail(failMethod: string) {
  mockSendCommand.mockImplementation(async (method: string) => {
    if (method === failMethod) throw new Error('RPC 超时');
    switch (method) {
      case 'collector-config-read':
        return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
      case 'laser-config-read':
        return { success: true, code: 'OK', message: '', data: laserData, timestamp: '' };
      case 'lidar-config-read':
        return { success: true, code: 'OK', message: '', data: algorithmData, timestamp: '' };
      case 'persistence-config-read':
        return { success: true, code: 'OK', message: '', data: persistenceData, timestamp: '' };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  });
}

describe('ConfigModal 配置读取', () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
  });

  it('全量读取成功 - 4个Tab显示表单字段且无占位文字', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.queryByText('采集卡表单占位')).not.toBeInTheDocument();
      expect(screen.queryByText('激光雷达表单占位')).not.toBeInTheDocument();
      expect(screen.queryByText('算法参数表单占位')).not.toBeInTheDocument();
      expect(screen.queryByText('持久化表单占位')).not.toBeInTheDocument();
    });

    // 采集卡 Tab（默认激活）应包含表单控件
    expect(document.querySelector('.ant-input-number')).toBeInTheDocument();
    expect(document.querySelector('.ant-select')).toBeInTheDocument();

    // sendCommand 被正确调用 4 次
    expect(mockSendCommand).toHaveBeenCalledTimes(4);
    expect(mockSendCommand).toHaveBeenCalledWith('collector-config-read');
    expect(mockSendCommand).toHaveBeenCalledWith('laser-config-read');
    expect(mockSendCommand).toHaveBeenCalledWith('lidar-config-read');
    expect(mockSendCommand).toHaveBeenCalledWith('persistence-config-read');
  });

  it('部分读取失败 - 失败Tab显示错误及重试按钮，成功Tab显示表单', async () => {
    mockPartialFail('collector-config-read');
    render(<ConfigModal open onClose={vi.fn()} />);

    // 采集卡 Tab 默认激活，应显示错误
    await waitFor(() => {
      expect(screen.getByText('配置加载失败')).toBeInTheDocument();
      expect(screen.getByText(/重\s*试/)).toBeInTheDocument();
    });

    // 切换到激光雷达 Tab
    fireEvent.click(screen.getByText('激光雷达'));
    await waitFor(() => {
      const activePane = document.querySelector('.ant-tabs-tabpane-active');
      expect(activePane?.querySelector('.ant-input-number')).toBeInTheDocument();
    });
  });

  it('全部读取失败 - 激活Tab显示错误提示和重试按钮', async () => {
    mockAllFail();
    render(<ConfigModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('配置加载失败')).toBeInTheDocument();
      expect(screen.getByText(/重\s*试/)).toBeInTheDocument();
    });

    // 切换到激光雷达 Tab 验证也是错误状态
    fireEvent.click(screen.getByText('激光雷达'));
    await waitFor(() => {
      const activePane = document.querySelector('.ant-tabs-tabpane-active');
      expect(activePane).toHaveTextContent('配置加载失败');
    });
  });

  it('重试按钮 - 点击后重新调用sendCommand', async () => {
    mockAllFail();
    render(<ConfigModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/重\s*试/)).toBeInTheDocument();
    });

    mockSendCommand.mockClear();
    mockAllSuccess();

    fireEvent.click(screen.getByText(/重\s*试/));

    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith('collector-config-read');
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
      expect(screen.queryByText('采集卡表单占位')).not.toBeInTheDocument();
    });
  });
});

// ── 保存功能 mock 扩展 ──

function mockUpdateSuccess() {
  mockSendCommand.mockImplementation(async (method: string, payload?: object) => {
    switch (method) {
      case 'collector-config-read':
        return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
      case 'laser-config-read':
        return { success: true, code: 'OK', message: '', data: laserData, timestamp: '' };
      case 'lidar-config-read':
        return { success: true, code: 'OK', message: '', data: algorithmData, timestamp: '' };
      case 'persistence-config-read':
        return { success: true, code: 'OK', message: '', data: persistenceData, timestamp: '' };
      case 'collector-config-update':
      case 'laser-config-update':
      case 'lidar-config-update':
      case 'persistence-config-update':
        return { success: true, code: 'OK', message: '', data: payload, timestamp: '' };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  });
}

function mockUpdateFail(errorMessage = '保存失败原因') {
  mockSendCommand.mockImplementation(async (method: string, payload?: object) => {
    switch (method) {
      case 'collector-config-read':
        return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
      case 'laser-config-read':
        return { success: true, code: 'OK', message: '', data: laserData, timestamp: '' };
      case 'lidar-config-read':
        return { success: true, code: 'OK', message: '', data: algorithmData, timestamp: '' };
      case 'persistence-config-read':
        return { success: true, code: 'OK', message: '', data: persistenceData, timestamp: '' };
      case 'collector-config-update':
      case 'laser-config-update':
      case 'lidar-config-update':
      case 'persistence-config-update':
        return { success: false, code: 'ERROR', message: errorMessage, data: null, timestamp: '' };
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  });
}

describe('ConfigModal 表单与保存', () => {
  beforeEach(() => {
    mockSendCommand.mockReset();
    mockMessageSuccess.mockClear();
    mockMessageError.mockClear();
  });

  async function renderAndWaitForLoad() {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });
  }

  it('采集卡Tab包含所有必填字段的表单控件', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    // 采集卡 Tab 默认激活，验证各字段的 label 和控件存在
    expect(screen.getByText('设备编号')).toBeInTheDocument();
    expect(screen.getByText('同步通道')).toBeInTheDocument();
    expect(screen.getByText('采样频率(kHz)')).toBeInTheDocument();
    expect(screen.getByText('时钟源')).toBeInTheDocument();
    expect(screen.getByText('半满阈值')).toBeInTheDocument();
    expect(screen.getByText('触发源')).toBeInTheDocument();
    expect(screen.getByText('量程')).toBeInTheDocument();

    // 验证 InputNumber 和 Select 控件存在
    const inputNumbers = document.querySelectorAll('.ant-input-number');
    const selects = document.querySelectorAll('.ant-select');
    expect(inputNumbers.length).toBeGreaterThanOrEqual(2);
    expect(selects.length).toBeGreaterThanOrEqual(5);
  });

  it('激光雷达 Tab 包含所有字段的表单控件', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('激光雷达'));
    await waitFor(() => {
      expect(screen.getByText('激光功率')).toBeInTheDocument();
    });
    expect(screen.getByText('调制频率')).toBeInTheDocument();
    expect(screen.getByText('串口号')).toBeInTheDocument();
    expect(screen.getByText('波特率')).toBeInTheDocument();
  });

  it('算法参数 Tab 包含所有11个字段的表单控件', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('算法参数'));
    await waitFor(() => {
      expect(screen.getByText('增益均衡系数')).toBeInTheDocument();
    });
    expect(screen.getByText('K常数')).toBeInTheDocument();
    expect(screen.getByText('接收孔径(m)')).toBeInTheDocument();
    expect(screen.getByText('传输路径长度(m)')).toBeInTheDocument();
    expect(screen.getByText('Cn²窗口帧数')).toBeInTheDocument();
    expect(screen.getByText('边界距离(m)')).toBeInTheDocument();
    expect(screen.getByText('激光波长(nm)')).toBeInTheDocument();
    expect(screen.getByText('Ångström指数')).toBeInTheDocument();
    expect(screen.getByText('暗电流采样点数')).toBeInTheDocument();
    expect(screen.getByText('采样率(Hz)')).toBeInTheDocument();
    expect(screen.getByText('盲区距离(m)')).toBeInTheDocument();
  });

  it('持久化 Tab 包含数据目录字段', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('持久化'));
    await waitFor(() => {
      expect(screen.getByText('数据目录')).toBeInTheDocument();
    });
  });

  it('采集卡必填校验 - 留空必填字段后点击保存显示校验错误', async () => {
    mockAllSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    // 清空采样频率 InputNumber 的值（必填字段）
    const sampleInput = document.querySelector('#sampleRate') as HTMLInputElement;
    fireEvent.change(sampleInput, { target: { value: '' } });

    // 点击保存
    const saveBtn = screen.getByRole('button', { name: /保\s*存/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      const hasError = document.querySelector('.ant-form-item-has-error');
      expect(hasError).toBeInTheDocument();
    });
  });

  it('保存成功 - sendCommand 被正确调用且显示成功消息', async () => {
    mockUpdateSuccess();
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /保\s*存/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith(
        'collector-config-update',
        expect.objectContaining({
          deviceId: expect.any(Number),
          syncChannelIndex: expect.any(Number),
        }),
      );
      expect(mockMessageSuccess).toHaveBeenCalledWith('保存成功');
    });
  });

  it('保存失败 - 服务器返回 success:false 时显示错误消息', async () => {
    mockUpdateFail('配置参数超出允许范围');
    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /保\s*存/ });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockMessageError).toHaveBeenCalledWith('配置参数超出允许范围');
    });
  });

  it('保存 loading - 保存期间按钮处于 loading 态', async () => {
    let resolveSave: (value: unknown) => void;
    const savePromise = new Promise((resolve) => { resolveSave = resolve; });

    mockAllSuccess();
    mockSendCommand.mockImplementation(async (method: string) => {
      if (method === 'collector-config-update') {
        await savePromise;
        return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
      }
      switch (method) {
        case 'collector-config-read':
          return { success: true, code: 'OK', message: '', data: collectorData, timestamp: '' };
        case 'laser-config-read':
          return { success: true, code: 'OK', message: '', data: laserData, timestamp: '' };
        case 'lidar-config-read':
          return { success: true, code: 'OK', message: '', data: algorithmData, timestamp: '' };
        case 'persistence-config-read':
          return { success: true, code: 'OK', message: '', data: persistenceData, timestamp: '' };
        default:
          throw new Error(`Unknown method: ${method}`);
      }
    });

    render(<ConfigModal open onClose={vi.fn()} />);
    await waitFor(() => {
      expect(screen.queryByText('配置加载失败')).not.toBeInTheDocument();
    });

    const saveBtn = screen.getByRole('button', { name: /保\s*存/ });
    fireEvent.click(saveBtn);

    // 等待异步保存启动
    await waitFor(() => {
      expect(mockSendCommand).toHaveBeenCalledWith(
        'collector-config-update',
        expect.any(Object),
      );
    });

    // 保存期间按钮应处于 loading 态
    expect(
      document.querySelector('.ant-btn-loading'),
    ).toBeInTheDocument();

    // 释放 Promise，完成保存
    resolveSave!(undefined);
    await waitFor(() => {
      expect(
        document.querySelector('.ant-btn-loading'),
      ).not.toBeInTheDocument();
    });
  });
});
