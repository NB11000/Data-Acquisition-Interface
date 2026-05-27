import { Button, Alert, message } from 'antd';
import { useDeviceStore } from '../../stores/deviceStore';
import { useCollectorStore } from '../../stores/collectorStore';
import { useLaserStore } from '../../stores/laserStore';
import { useMqttStore } from '../../stores/mqttStore';
import { useRpcCommand } from '../../hooks/useRpcCommand';
import { Clock } from '../../components/Clock';
import { MqttStatusIndicator } from '../../components/MqttStatusIndicator';
import styles from './StatusControlBar.module.css';

export function StatusControlBar() {
  const selectedId = useDeviceStore((s) => s.selectedId);
  const devices = useDeviceStore((s) => s.devices);
  const selectedDevice = devices.find((d) => d.id === selectedId);

  const collector = useCollectorStore();
  const laser = useLaserStore();
  const willReceived = useMqttStore((s) => s.willReceived);
  const willDeviceId = useMqttStore((s) => s.willDeviceId);
  const mqttConnected = useMqttStore((s) => s.mqttConnected);

  const { sendCommand } = useRpcCommand();

  const allDisabled = !mqttConnected || willReceived || !selectedId;

  const computeDisabled = () => {
    if (allDisabled) return { open: true, close: true, start: true, stop: true, connect: true, disconnect: true, laserOn: true, laserOff: true };

    const collectorOpen = collector.deviceOpened;
    const isAcquiring = collector.acquiring;
    const laserConnected = laser.serialConnected;
    const laserEmitting = laser.emissionOn;

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
            type={getButtonType(collector.openButtonPhase, collector.deviceOpened)}
            disabled={disabled.open}
            loading={collector.openButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-open-device',
                () => collector.setButtonPhase('open', 'sending'),
                () => { collector.setButtonPhase('open', 'running'); collector.setDeviceOpened(true); },
                () => collector.setButtonPhase('open', 'idle'),
              )
            }
          >
            {getButtonLabel(collector.openButtonPhase, '已打开', '打开采集卡')}
          </Button>
          <Button
            size="small"
            type={getButtonType(collector.startButtonPhase, collector.acquiring)}
            danger={collector.startButtonPhase === 'running'}
            disabled={disabled.start}
            loading={collector.startButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'collector-start-ad',
                () => collector.setButtonPhase('start', 'sending'),
                () => { collector.setButtonPhase('start', 'running'); collector.setAcquiring(true); },
                () => collector.setButtonPhase('start', 'idle'),
              )
            }
          >
            {getButtonLabel(collector.startButtonPhase, '采集中', '开始采集')}
          </Button>
        </div>

        <div className={styles.group}>
          <span className={styles.groupLabel}>激光器</span>
          <Button
            size="small"
            type={getButtonType(laser.connectButtonPhase, laser.serialConnected)}
            disabled={disabled.connect}
            loading={laser.connectButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-connect',
                () => laser.setButtonPhase('connect', 'sending'),
                () => { laser.setButtonPhase('connect', 'running'); laser.setSerialConnected(true); },
                () => laser.setButtonPhase('connect', 'idle'),
              )
            }
          >
            {getButtonLabel(laser.connectButtonPhase, '已连接', '连接激光')}
          </Button>
          <Button
            size="small"
            type={getButtonType(laser.laserButtonPhase, laser.emissionOn)}
            danger={laser.laserButtonPhase === 'running'}
            disabled={disabled.laserOn}
            loading={laser.laserButtonPhase === 'sending'}
            onClick={() =>
              handleRpc(
                'laser-on',
                () => laser.setButtonPhase('laser', 'sending'),
                () => { laser.setButtonPhase('laser', 'running'); laser.setEmissionOn(true); },
                () => laser.setButtonPhase('laser', 'idle'),
              )
            }
          >
            {getButtonLabel(laser.laserButtonPhase, '发射中', '开启激光')}
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
