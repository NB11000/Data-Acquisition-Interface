import type { CommandResult, SystemStateDto } from '../mqtt/types';
import type { MqttClientLike } from '../mqtt/mqttClientLike';

const defaultCollectorConfig = {
  deviceId: 0, syncChannelIndex: 2, sampleRate: 1000, clockSourceIndex: 0,
  halfFullThreshold: 5, triggerSourceIndex: 1, rangeIndex: 0,
};

// ── Per-device default state factory (Issue 10) ──

function createDefaultState(): SystemStateDto {
  return {
    server: { isApiAlive: true, timestamp: new Date().toISOString() },
    collector: {
      processConnected: true,
      deviceOpened: false,
      acquiring: false,
      lastMessage: '',
    },
    laser: {
      serialConnected: false,
      emissionOn: false,
      portName: 'COM3',
      lastMessage: '',
    },
    timestamp: new Date().toISOString(),
  };
}

const stateMap = new Map<string, SystemStateDto>();

function ensureState(machineId: string): SystemStateDto {
  if (!stateMap.has(machineId)) {
    stateMap.set(machineId, createDefaultState());
  }
  return stateMap.get(machineId)!;
}

export function getMockState(machineId: string): SystemStateDto {
  return { ...ensureState(machineId), timestamp: new Date().toISOString() };
}

export function handleMockRpc(
  mockClient: MqttClientLike,
  machineId: string,
  method: string,
  corrId: string,
  payload?: unknown,
): void {
  const responseTopic = `$rpc/${machineId}/${method}/${corrId}/response`;
  const delay = 200 + Math.random() * 300; // 200-500ms

  setTimeout(() => {
    let result: CommandResult;
    const currentState = ensureState(machineId);

    switch (method) {
      case 'system-state':
        result = {
          success: true,
          code: 'OK',
          message: '系统状态获取成功',
          state: getMockState(machineId),
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-open-device':
        currentState.collector.deviceOpened = true;
        result = { success: true, code: 'COLLECTOR_OPENED', message: '采集卡已打开', timestamp: new Date().toISOString() };
        break;

      case 'collector-close-device':
        currentState.collector.deviceOpened = false;
        currentState.collector.acquiring = false;
        result = { success: true, code: 'COLLECTOR_CLOSED', message: '采集卡已关闭', timestamp: new Date().toISOString() };
        break;

      case 'collector-start-ad':
        if (!currentState.collector.deviceOpened) {
          result = { success: false, code: 'PRECONDITION_DEVICE_NOT_OPENED', message: '请先打开采集卡', timestamp: new Date().toISOString() };
          break;
        }
        currentState.collector.acquiring = true;
        result = { success: true, code: 'AD_STARTED', message: '采集已开始', timestamp: new Date().toISOString() };
        break;

      case 'collector-stop-ad':
        if (!currentState.collector.acquiring) {
          result = { success: false, code: 'PRECONDITION_NOT_ACQUIRING', message: '当前未在采集', timestamp: new Date().toISOString() };
          break;
        }
        currentState.collector.acquiring = false;
        result = { success: true, code: 'AD_STOPPED', message: '采集已停止', timestamp: new Date().toISOString() };
        break;

      case 'laser-connect':
        currentState.laser.serialConnected = true;
        result = { success: true, code: 'LASER_CONNECTED', message: '激光器已连接', timestamp: new Date().toISOString() };
        break;

      case 'laser-disconnect':
        if (!currentState.laser.serialConnected) {
          result = { success: false, code: 'PRECONDITION_LASER_NOT_CONNECTED', message: '激光器未连接', timestamp: new Date().toISOString() };
          break;
        }
        currentState.laser.serialConnected = false;
        currentState.laser.emissionOn = false;
        result = { success: true, code: 'LASER_DISCONNECTED', message: '激光器已断开', timestamp: new Date().toISOString() };
        break;

      case 'laser-on':
        if (!currentState.laser.serialConnected) {
          result = { success: false, code: 'PRECONDITION_LASER_NOT_CONNECTED', message: '请先连接激光器', timestamp: new Date().toISOString() };
          break;
        }
        currentState.laser.emissionOn = true;
        result = { success: true, code: 'LASER_ON', message: '激光已开启', timestamp: new Date().toISOString() };
        break;

      case 'laser-off':
        if (!currentState.laser.emissionOn) {
          result = { success: false, code: 'PRECONDITION_LASER_NOT_EMITTING', message: '激光未在发射', timestamp: new Date().toISOString() };
          break;
        }
        currentState.laser.emissionOn = false;
        result = { success: true, code: 'LASER_OFF', message: '激光已关闭', timestamp: new Date().toISOString() };
        break;

      case 'collector-config-read':
        result = {
          success: true, code: 'OK', message: '采集卡配置读取成功',
          data: defaultCollectorConfig,
          timestamp: new Date().toISOString(),
        };
        break;

      case 'collector-config-update':
        result = { success: true, code: 'OK', message: '采集卡配置更新成功', data: payload, timestamp: new Date().toISOString() };
        break;

      case 'collector-config-default':
        result = {
          success: true, code: 'OK', message: '默认采集卡配置',
          data: defaultCollectorConfig,
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-config-read':
        result = {
          success: true, code: 'OK', message: '激光雷达配置读取成功',
          data: { laserPower: 100, laserModulationFrequency: 1000, serialPort: 'COM3', baudRate: 9600 },
          timestamp: new Date().toISOString(),
        };
        break;

      case 'laser-config-update':
        result = { success: true, code: 'OK', message: '激光雷达配置更新成功', data: payload, timestamp: new Date().toISOString() };
        break;

      case 'lidar-config-read':
        result = {
          success: true, code: 'OK', message: '激光雷达算法配置读取成功',
          data: {
            gainEqualizationCoefficient: 1.0, kConstant: 4.48, receiverApertureD_m: 0.2,
            pathLengthL_m: 1000.0, cn2WindowFrames: 100, fernaldBoundaryDistance_m: 3000.0,
            laserWavelength_nm: 532.0, angstromExponent: 1.3, darkCurrentSampleCount: 0,
            sampleRateHz: 20000000.0, blindZoneDistance_m: 30.0,
          },
          timestamp: new Date().toISOString(),
        };
        break;

      case 'lidar-config-update':
        result = { success: true, code: 'OK', message: '激光雷达算法配置更新成功', data: payload, timestamp: new Date().toISOString() };
        break;

      case 'persistence-config-read':
        result = {
          success: true, code: 'OK', message: '持久化配置读取成功',
          data: { dataDirectory: 'data' },
          timestamp: new Date().toISOString(),
        };
        break;

      case 'persistence-config-update':
        result = { success: true, code: 'OK', message: '持久化配置更新成功', data: payload, timestamp: new Date().toISOString() };
        break;

      default:
        result = { success: false, code: 'UNKNOWN_METHOD', message: `未知方法: ${method}`, timestamp: new Date().toISOString() };
    }

    const encodedPayload = new TextEncoder().encode(JSON.stringify(result));
    mockClient.injectMessage(responseTopic, encodedPayload);

    // 模拟真实设备行为：RPC 成功后推送 state_changed 事件
    if (result.success && method !== 'system-state') {
      const stateEvent = {
        eventType: 'state_changed',
        source: method.startsWith('collector') ? 'collector' : 'laser',
        reason: method,
        message: result.message,
        state: getMockState(machineId),
        timestamp: new Date().toISOString(),
      };
      const stateTopic = `daq/${machineId}/events/state_changed`;
      const statePayload = new TextEncoder().encode(JSON.stringify(stateEvent));
      setTimeout(() => mockClient.injectMessage(stateTopic, statePayload), 50);
    }
  }, delay);
}
