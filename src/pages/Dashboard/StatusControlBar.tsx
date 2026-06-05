import { useState } from 'react';
import { Button, Alert, message } from 'antd';
import { SettingOutlined } from '@ant-design/icons';
import { useDeviceStore } from '../../stores/deviceStore';
import { useCollectorStore } from '../../stores/collectorStore';
import { useLaserStore } from '../../stores/laserStore';
import { useMqttStore } from '../../stores/mqttStore';
import { useRpcCommand } from '../../hooks/useRpcCommand';
import { Clock } from '../../components/Clock';
import { ConfigModal } from './components/ConfigModal';
import { MqttStatusIndicator } from '../../components/MqttStatusIndicator';
import styles from './StatusControlBar.module.css';

export function StatusControlBar() {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const processConnected = useCollectorStore((s) => s.processConnected);
  const deviceOpened = useCollectorStore((s) => s.deviceOpened);
  const acquiring = useCollectorStore((s) => s.acquiring);
  const openButtonPhase = useCollectorStore((s) => s.openButtonPhase);
  const startButtonPhase = useCollectorStore((s) => s.startButtonPhase);
  const setCollectorButtonPhase = useCollectorStore((s) => s.setButtonPhase);
  const setDeviceOpened = useCollectorStore((s) => s.setDeviceOpened);
  const setAcquiring = useCollectorStore((s) => s.setAcquiring);

  const serialConnected = useLaserStore((s) => s.serialConnected);
  const emissionOn = useLaserStore((s) => s.emissionOn);
  const connectButtonPhase = useLaserStore((s) => s.connectButtonPhase);
  const laserButtonPhase = useLaserStore((s) => s.laserButtonPhase);
  const setLaserButtonPhase = useLaserStore((s) => s.setButtonPhase);
  const setSerialConnected = useLaserStore((s) => s.setSerialConnected);
  const setEmissionOn = useLaserStore((s) => s.setEmissionOn);

  const willReceived = useMqttStore((s) => s.willReceived);
  const willDeviceId = useMqttStore((s) => s.willDeviceId);
  const mqttConnected = useMqttStore((s) => s.mqttConnected);

  const { sendCommand } = useRpcCommand();

  const allDisabled = !mqttConnected || willReceived || !selectedId || !selectedDevice;

  const [configModalOpen, setConfigModalOpen] = useState(false);

  // 采集卡: 采集中禁用
  const collectorDisabled = allDisabled || acquiring;
  // 采集: 采集卡未打开时禁用
  const acquisitionDisabled = allDisabled || !deviceOpened;
  // 激光: 发射中禁用
  const laserDisabled = allDisabled || emissionOn;
  // 发射: 激光未连接时禁用
  const emissionDisabled = allDisabled || !serialConnected;

  const handleRpc = async (
    method: string,
    setSending: () => void,
    setSuccess: () => void,
    setReset: () => void,
  ) => {
    setSending();
    try {
      const result = await sendCommand(method);
      if (result.success) {
        setSuccess();
      } else {
        setReset();
        message.error(result.message);
      }
    } catch {
      setReset();
      message.error('服务端无响应 (RPC 超时)');
    }
  };

  return (
    <>
    <div className={styles.container}>
      <div className={styles.row1}>
        <div className={styles.deviceInfo}>
          {selectedDevice ? (
            <>
              <span className={styles.deviceName}>{selectedDevice.name}</span>
              <span className={styles.deviceId}>{selectedDevice.id}</span>
            </>
          ) : (
            <span className={styles.deviceId}>未选中设备</span>
          )}
          <MqttStatusIndicator />
        </div>
        <Clock />
      </div>

      <div className={styles.row2}>
        <div className={styles.group}>
          <span className={styles.groupLabel}>采集卡</span>
          <Button
            size="small"
            type={deviceOpened ? 'primary' : 'default'}
            disabled={collectorDisabled}
            loading={openButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                deviceOpened ? 'collector-close-device' : 'collector-open-device',
                () => setCollectorButtonPhase('open', 'sending'),
                () => { setCollectorButtonPhase('open', 'idle'); setDeviceOpened(!deviceOpened); },
                () => setCollectorButtonPhase('open', 'idle'),
              )
            }
          >
            {openButtonPhase === 'sending' ? '发送中...' : deviceOpened ? '关闭采集卡' : '打开采集卡'}
          </Button>
          <Button
            size="small"
            type={acquiring ? 'primary' : 'default'}
            danger={acquiring}
            disabled={acquisitionDisabled}
            loading={startButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                acquiring ? 'collector-stop-ad' : 'collector-start-ad',
                () => setCollectorButtonPhase('start', 'sending'),
                () => { setCollectorButtonPhase('start', 'idle'); setAcquiring(!acquiring); },
                () => setCollectorButtonPhase('start', 'idle'),
              )
            }
          >
            {startButtonPhase === 'sending' ? '发送中...' : acquiring ? '停止采集' : '开始采集'}
          </Button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>激光器</span>
          <Button
            size="small"
            type={serialConnected ? 'primary' : 'default'}
            disabled={laserDisabled}
            loading={connectButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                serialConnected ? 'laser-disconnect' : 'laser-connect',
                () => setLaserButtonPhase('connect', 'sending'),
                () => { setLaserButtonPhase('connect', 'idle'); setSerialConnected(!serialConnected); },
                () => setLaserButtonPhase('connect', 'idle'),
              )
            }
          >
            {connectButtonPhase === 'sending' ? '发送中...' : serialConnected ? '关闭串口' : '打开串口'}
          </Button>
          <Button
            size="small"
            type={emissionOn ? 'primary' : 'default'}
            danger={emissionOn}
            disabled={emissionDisabled}
            loading={laserButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                emissionOn ? 'laser-off' : 'laser-on',
                () => setLaserButtonPhase('laser', 'sending'),
                () => { setLaserButtonPhase('laser', 'idle'); setEmissionOn(!emissionOn); },
                () => setLaserButtonPhase('laser', 'idle'),
              )
            }
          >
            {laserButtonPhase === 'sending' ? '发送中...' : emissionOn ? '关闭激光' : '开启激光'}
          </Button>
        </div>

        <div className={styles.group}>
          <Button
            size="small"
            icon={<SettingOutlined />}
            disabled={allDisabled}
            onClick={() => setConfigModalOpen(true)}
          >
            设置参数
          </Button>
        </div>
      </div>

      {willReceived && (
        <div className={styles.banner}>
          <Alert
            type="error"
            showIcon
            message={`⚠️ 设备 [${willDeviceId}] 已离线，主控进程可能已崩溃或网络断开`}
            banner
          />
        </div>
      )}
      {!mqttConnected && !willReceived && (
        <div className={styles.banner}>
          <Alert
            type="warning"
            showIcon
            message="MQTT 连接断开，命令通道和状态通道均已中断"
            banner
          />
        </div>
      )}
    </div>
    <ConfigModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
    </>
  );
}
