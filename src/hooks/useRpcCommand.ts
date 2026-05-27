import { useCallback } from 'react';
import { getMqttClient } from '../mqtt/client';
import { sendRpcCommand as sendRpc } from '../mqtt/rpc';
import { useDeviceStore } from '../stores/deviceStore';
import type { CommandResult } from '../mqtt/types';

export function useRpcCommand(): {
  sendCommand: (method: string, payload?: object) => Promise<CommandResult>;
} {
  const sendCommand = useCallback(async (method: string, payload?: object) => {
    const selectedId = useDeviceStore.getState().selectedId;
    if (!selectedId) {
      throw new Error('未选中设备');
    }
    const client = getMqttClient();
    return sendRpc(client, selectedId, method, payload);
  }, []);

  return { sendCommand };
}
