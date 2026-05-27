import { Button, Alert, message } from 'antd';
import { useDeviceStore } from '../../stores/deviceStore';
import { useCollectorStore } from '../../stores/collectorStore';
import { useLaserStore } from '../../stores/laserStore';
import { useMqttStore } from '../../stores/mqttStore';
import { useRpcCommand } from '../../hooks/useRpcCommand';
import { Clock } from '../../components/Clock';
import { MqttStatusIndicator } from '../../components/MqttStatusIndicator';
import styles from './StatusControlBar.module.css';

const getButtonLabel = (phase: string, running: string, idle: string) => {
  if (phase === 'sending') return '发送中...';
  if (phase === 'running') return running;
  return idle;
};

const getButtonType = (phase: string, running: boolean) => {
  if (phase === 'sending') return undefined;
  if (phase === 'running') return running ? 'primary' : 'default';
  return 'default';
};

export function StatusControlBar() {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const selectedDevice = devices.find((d) => d.id === selectedId);

  // Selective store subscriptions — only the fields actually used
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

  const allDisabled = !mqttConnected || willReceived || !selectedId;

  const computeDisabled = () => {
    if (allDisabled) return { open: true, close: true, start: true, stop: true, connect: true, disconnect: true, laserOn: true, laserOff: true };

    const collectorOpen = deviceOpened;
    const isAcquiring = acquiring;
    const laserConnected = serialConnected;
    const laserEmitting = emissionOn;

    return {
      open: collectorOpen,
      close: !collectorOpen,
      start: isAcquiring,
      stop: !isAcquiring,
      connect: laserConnected,
      disconnect: !laserConnected,
      laserOn: laserEmitting || !laserConnected,
      laserOff: !laserEmitting || !laserConnected,
    };
  };

  const disabled = computeDisabled();

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
            type={getButtonType(openButtonPhase, deviceOpened)}
            disabled={disabled.open}
            loading={openButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-open-device',
                () => setCollectorButtonPhase('open', 'sending'),
                () => { setCollectorButtonPhase('open', 'running'); setDeviceOpened(true); },
                () => setCollectorButtonPhase('open', 'idle'),
              )
            }
          >
            {getButtonLabel(openButtonPhase, '已打开', '打开采集卡')}
          </Button>
          <Button
            size="small"
            type={getButtonType(startButtonPhase, acquiring)}
            danger={startButtonPhase === 'running'}
            disabled={disabled.start}
            loading={startButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-start-ad',
                () => setCollectorButtonPhase('start', 'sending'),
                () => { setCollectorButtonPhase('start', 'running'); setAcquiring(true); },
                () => setCollectorButtonPhase('start', 'idle'),
              )
            }
          >
            {getButtonLabel(startButtonPhase, '采集中', '开始采集')}
          </Button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>激光器</span>
          <Button
            size="small"
            type={getButtonType(connectButtonPhase, serialConnected)}
            disabled={disabled.connect}
            loading={connectButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-connect',
                () => setLaserButtonPhase('connect', 'sending'),
                () => { setLaserButtonPhase('connect', 'running'); setSerialConnected(true); },
                () => setLaserButtonPhase('connect', 'idle'),
              )
            }
          >
            {getButtonLabel(connectButtonPhase, '已连接', '连接激光')}
          </Button>
          <Button
            size="small"
            type={getButtonType(laserButtonPhase, emissionOn)}
            danger={laserButtonPhase === 'running'}
            disabled={disabled.laserOn}
            loading={laserButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-on',
                () => setLaserButtonPhase('laser', 'sending'),
                () => { setLaserButtonPhase('laser', 'running'); setEmissionOn(true); },
                () => setLaserButtonPhase('laser', 'idle'),
              )
            }
          >
            {getButtonLabel(laserButtonPhase, '发射中', '开启激光')}
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
  );
}
