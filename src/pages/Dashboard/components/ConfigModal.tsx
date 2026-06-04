import { useCallback, useEffect, useState } from 'react';
import { Modal, Tabs, Form, Spin, Alert, Button, Input, InputNumber, Select, message } from 'antd';
import type { TabsProps } from 'antd';
import { useRpcCommand } from '../../../hooks/useRpcCommand';
import type { CommandResult } from '../../../mqtt/types';
import styles from './ConfigModal.module.css';

export interface CaptureCardConfig {
  deviceId: number;
  syncChannelIndex: number;
  sampleRate: number;
  clockSourceIndex: number;
  halfFullThreshold: number;
  triggerSourceIndex: number;
  rangeIndex: number;
}

export interface RadarConfig {
  laserPower: number;
  laserModulationFrequency: number;
  serialPort: string;
  baudRate: number;
}

export interface LidarAlgorithmConfig {
  gainEqualizationCoefficient: number;
  kConstant: number;
  receiverApertureD_m: number;
  pathLengthL_m: number;
  cn2WindowFrames: number;
  fernaldBoundaryDistance_m: number;
  laserWavelength_nm: number;
  angstromExponent: number;
  darkCurrentSampleCount: number;
  sampleRateHz: number;
  blindZoneDistance_m: number;
}

export interface PersistenceSettings {
  dataDirectory: string;
}

export const SYNC_CHANNEL_OPTIONS = [
  { label: '通道1', value: 0 },
  { label: '通道2', value: 1 },
  { label: '双通道', value: 2 },
] as const;

export const CLOCK_SOURCE_OPTIONS = [
  { label: '内时钟', value: 0 },
  { label: '外时钟', value: 1 },
] as const;

export const HALF_FULL_OPTIONS = [
  { label: '2M', value: 0 },
  { label: '4M', value: 1 },
  { label: '8M', value: 2 },
  { label: '16M', value: 3 },
  { label: '32M', value: 4 },
  { label: '64M', value: 5 },
  { label: '128M', value: 6 },
  { label: '16K', value: 7 },
] as const;

export const TRIGGER_SOURCE_OPTIONS = [
  { label: '外触发', value: 0 },
  { label: '软触发', value: 1 },
] as const;

export const RANGE_OPTIONS = [
  { label: '±5V', value: 0 },
  { label: '±10V', value: 1 },
] as const;

export const BAUD_RATE_OPTIONS = [
  { label: '1200', value: 1200 },
  { label: '2400', value: 2400 },
  { label: '4800', value: 4800 },
  { label: '9600', value: 9600 },
  { label: '19200', value: 19200 },
  { label: '38400', value: 38400 },
  { label: '57600', value: 57600 },
  { label: '115200', value: 115200 },
] as const;

// ── 加载状态 ──
type LoadState = 'loading' | 'idle' | 'error';

interface ConfigModalProps {
  open: boolean;
  onClose: () => void;
}

// ── RPC 方法映射 ──
const configKeys = ['collector', 'laser', 'algorithm', 'persistence'] as const;
const configMethods: Record<string, string> = {
  collector: 'collector-config-read',
  laser: 'laser-config-read',
  algorithm: 'lidar-config-read',
  persistence: 'persistence-config-read',
};
const defaultLoadStates: Record<string, LoadState> = {
  collector: 'loading',
  laser: 'loading',
  algorithm: 'loading',
  persistence: 'loading',
};

const updateMethods: Record<string, string> = {
  collector: 'collector-config-update',
  laser: 'laser-config-update',
  algorithm: 'lidar-config-update',
  persistence: 'persistence-config-update',
};

export function ConfigModal({ open, onClose }: ConfigModalProps) {
  const { sendCommand } = useRpcCommand();

  const [collectorForm] = Form.useForm();
  const [laserForm] = Form.useForm();
  const [algorithmForm] = Form.useForm();
  const [persistenceForm] = Form.useForm();

  const formMap: Record<string, ReturnType<typeof Form.useForm>[0]> = {
    collector: collectorForm,
    laser: laserForm,
    algorithm: algorithmForm,
    persistence: persistenceForm,
  };

  const [loadStates, setLoadStates] = useState<Record<string, LoadState>>(defaultLoadStates);

  const [saving, setSaving] = useState<Record<string, boolean>>({
    collector: false, laser: false, algorithm: false, persistence: false,
  });

  const handleSave = async (key: string) => {
    const form = formMap[key];
    try {
      const values = await form.validateFields();
      setSaving(prev => ({ ...prev, [key]: true }));
      const result = await sendCommand(updateMethods[key], values as object);
      if (result.success) {
        message.success('保存成功');
      } else {
        message.error(result.message || '保存失败');
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return;
      }
      message.error('保存失败，请稍后重试');
    } finally {
      setSaving(prev => ({ ...prev, [key]: false }));
    }
  };

  const renderSaveFooter = (key: string) => (
    <div className={styles.formFooter}>
      <Button type="primary" loading={saving[key]} onClick={() => handleSave(key)}>保存</Button>
    </div>
  );

  // ── 加载单个 Tab 的配置 ──
  const loadConfig = useCallback(async (key: string) => {
    setLoadStates(prev => ({ ...prev, [key]: 'loading' }));
    try {
      const result: CommandResult = await sendCommand(configMethods[key]);
      if (result.success && result.data) {
        formMap[key].setFieldsValue(result.data as Record<string, unknown>);
        setLoadStates(prev => ({ ...prev, [key]: 'idle' }));
      } else {
        setLoadStates(prev => ({ ...prev, [key]: 'error' }));
      }
    } catch {
      setLoadStates(prev => ({ ...prev, [key]: 'error' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sendCommand]);

  // ── 弹窗打开时并发读取配置 ──
  useEffect(() => {
    if (!open) return;
    setLoadStates({ ...defaultLoadStates });
    for (const key of configKeys) {
      loadConfig(key);
    }
  }, [open, loadConfig]);

  // ── 渲染 Tab 内容：根据 loadState 切换 loading/error/form ──
  function renderTabContent(key: string, renderForm: () => React.ReactNode) {
    const state = loadStates[key];
    if (state === 'loading') {
      return (
        <div className={styles.loadingWrap}>
          <Spin />
        </div>
      );
    }
    if (state === 'error') {
      return (
        <div className={styles.errorWrap}>
          <Alert
            type="error"
            message="配置加载失败"
            action={
              <Button onClick={() => loadConfig(key)}>重试</Button>
            }
          />
        </div>
      );
    }
    return renderForm();
  }

  const tabItems: TabsProps['items'] = [
    {
      key: 'collector',
      label: '采集卡',
      children: renderTabContent('collector', () =>
        <Form form={collectorForm} layout="vertical">
          <Form.Item name="deviceId" label="设备编号">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="syncChannelIndex" label="同步通道" rules={[{ required: true, message: '请选择同步通道' }]}>
            <Select options={[...SYNC_CHANNEL_OPTIONS]} />
          </Form.Item>
          <Form.Item name="sampleRate" label="采样频率(kHz)" rules={[{ required: true, message: '请输入采样频率' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="clockSourceIndex" label="时钟源" rules={[{ required: true, message: '请选择时钟源' }]}>
            <Select options={[...CLOCK_SOURCE_OPTIONS]} />
          </Form.Item>
          <Form.Item name="halfFullThreshold" label="半满阈值" rules={[{ required: true, message: '请选择半满阈值' }]}>
            <Select options={[...HALF_FULL_OPTIONS]} />
          </Form.Item>
          <Form.Item name="triggerSourceIndex" label="触发源" rules={[{ required: true, message: '请选择触发源' }]}>
            <Select options={[...TRIGGER_SOURCE_OPTIONS]} />
          </Form.Item>
          <Form.Item name="rangeIndex" label="量程" rules={[{ required: true, message: '请选择量程' }]}>
            <Select options={[...RANGE_OPTIONS]} />
          </Form.Item>
          {renderSaveFooter('collector')}
        </Form>,
      ),
    },
    {
      key: 'laser',
      label: '激光雷达',
      children: renderTabContent('laser', () =>
        <Form form={laserForm} layout="vertical">
          <Form.Item name="laserPower" label="激光功率" rules={[{ required: true, message: '请输入激光功率' }]}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="laserModulationFrequency" label="调制频率" rules={[{ required: true, message: '请输入调制频率' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="serialPort" label="串口号" rules={[{ required: true, message: '请输入串口号' }]}>
            <Input placeholder="如 COM3" />
          </Form.Item>
          <Form.Item name="baudRate" label="波特率" rules={[{ required: true, message: '请选择波特率' }]}>
            <Select options={[...BAUD_RATE_OPTIONS]} />
          </Form.Item>
          {renderSaveFooter('laser')}
        </Form>,
      ),
    },
    {
      key: 'algorithm',
      label: '算法参数',
      children: renderTabContent('algorithm', () =>
        <Form form={algorithmForm} layout="vertical">
          <Form.Item name="gainEqualizationCoefficient" label="增益均衡系数" rules={[{ required: true, message: '请输入增益均衡系数' }]}>
            <InputNumber step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="kConstant" label="K常数" rules={[{ required: true, message: '请输入K常数' }]}>
            <InputNumber step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="receiverApertureD_m" label="接收孔径(m)" rules={[{ required: true, message: '请输入接收孔径' }]}>
            <InputNumber step={0.001} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="pathLengthL_m" label="传输路径长度(m)" rules={[{ required: true, message: '请输入传输路径长度' }]}>
            <InputNumber step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="cn2WindowFrames" label="Cn²窗口帧数" rules={[{ required: true, message: '请输入Cn²窗口帧数' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="fernaldBoundaryDistance_m" label="边界距离(m)" rules={[{ required: true, message: '请输入边界距离' }]}>
            <InputNumber step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="laserWavelength_nm" label="激光波长(nm)" rules={[{ required: true, message: '请输入激光波长' }]}>
            <InputNumber step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="angstromExponent" label="Ångström指数" rules={[{ required: true, message: '请输入Ångström指数' }]}>
            <InputNumber step={0.01} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="darkCurrentSampleCount" label="暗电流采样点数" rules={[{ required: true, message: '请输入暗电流采样点数' }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sampleRateHz" label="采样率(Hz)" rules={[{ required: true, message: '请输入采样率' }]}>
            <InputNumber step={1000} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="blindZoneDistance_m" label="盲区距离(m)" rules={[{ required: true, message: '请输入盲区距离' }]}>
            <InputNumber step={0.1} style={{ width: '100%' }} />
          </Form.Item>
          {renderSaveFooter('algorithm')}
        </Form>,
      ),
    },
    {
      key: 'persistence',
      label: '持久化',
      children: renderTabContent('persistence', () =>
        <Form form={persistenceForm} layout="vertical">
          <Form.Item name="dataDirectory" label="数据目录" rules={[{ required: true, message: '请输入数据目录' }]}>
            <Input placeholder="如 data" />
          </Form.Item>
          {renderSaveFooter('persistence')}
        </Form>,
      ),
    },
  ];

  return (
    <Modal
      title="设备参数配置"
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      destroyOnHidden
    >
      <Tabs defaultActiveKey="collector" items={tabItems} />
    </Modal>
  );
}
