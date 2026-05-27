export function waveformCh1Topic(machineId: string): string {
  return `daq/${machineId}/waveform/ch1`;
}

export function waveformCh2Topic(machineId: string): string {
  return `daq/${machineId}/waveform/ch2`;
}

export function stateChangedTopic(machineId: string): string {
  return `daq/${machineId}/events/state_changed`;
}

export function willTopic(machineId: string): string {
  return `daq/${machineId}/events/will`;
}

export function deviceAlarmTopic(machineId: string): string {
  return `daq/${machineId}/events/device_alarm`;
}

export function lowFreqTopic(machineId: string): string {
  return `daq/${machineId}/lowfreq`;
}

export function rpcRequestTopic(machineId: string, method: string, corrId: string): string {
  return `$rpc/${machineId}/${method}/${corrId}`;
}

export function rpcResponsePattern(machineId: string): string {
  return `$rpc/${machineId}/+/+/response`;
}

export function allDeviceEventsPattern(machineId: string): string {
  return `daq/${machineId}/events/#`;
}

export function allDeviceWaveformPattern(machineId: string): string {
  return `daq/${machineId}/waveform/#`;
}

export function sysClientConnectedTopic(): string {
  return '$SYS/brokers/+/clients/+/connected';
}

export function sysClientDisconnectedTopic(): string {
  return '$SYS/brokers/+/clients/+/disconnected';
}
