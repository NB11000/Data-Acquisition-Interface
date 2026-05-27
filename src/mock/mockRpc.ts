import type { CommandResult, SystemStateDto } from '../mqtt/types';
import type { MockMqttClient } from './mockMqttClient';

const defaultState: SystemStateDto = {
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

let currentState: SystemStateDto = { ...defaultState };

export function getMockState(): SystemStateDto {
  return { ...currentState, timestamp: new Date().toISOString() };
}

export function handleMockRpc(
  mockClient: MockMqttClient,
  machineId: string,
  method: string,
  corrId: string,
): void {
  const responseTopic = `$rpc/${machineId}/${method}/${corrId}/response`;
  const delay = 200 + Math.random() * 300; // 200-500ms

  setTimeout(() => {
    let result: CommandResult;

    switch (method) {
      case 'SYSTEM_STATE':
        result = {
          success: true,
          code: 'OK',
          message: '系统状态获取成功',
          state: getMockState(),
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
        currentState.collector.acquiring = true;
        result = { success: true, code: 'AD_STARTED', message: '采集已开始', timestamp: new Date().toISOString() };
        break;

      case 'collector-stop-ad':
        currentState.collector.acquiring = false;
        result = { success: true, code: 'AD_STOPPED', message: '采集已停止', timestamp: new Date().toISOString() };
        break;

      case 'laser-connect':
        currentState.laser.serialConnected = true;
        result = { success: true, code: 'LASER_CONNECTED', message: '激光器已连接', timestamp: new Date().toISOString() };
        break;

      case 'laser-disconnect':
        currentState.laser.serialConnected = false;
        currentState.laser.emissionOn = false;
        result = { success: true, code: 'LASER_DISCONNECTED', message: '激光器已断开', timestamp: new Date().toISOString() };
        break;

      case 'laser-on':
        currentState.laser.emissionOn = true;
        result = { success: true, code: 'LASER_ON', message: '激光已开启', timestamp: new Date().toISOString() };
        break;

      case 'laser-off':
        currentState.laser.emissionOn = false;
        result = { success: true, code: 'LASER_OFF', message: '激光已关闭', timestamp: new Date().toISOString() };
        break;

      default:
        result = { success: false, code: 'UNKNOWN_METHOD', message: `未知方法: ${method}`, timestamp: new Date().toISOString() };
    }

    const payload = new TextEncoder().encode(JSON.stringify(result));
    mockClient.injectMessage(responseTopic, payload);
  }, delay);
}
