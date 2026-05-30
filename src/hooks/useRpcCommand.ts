import { useCallback } from 'react';
import { sendRpcCommand as sendRpc } from '../mqtt/rpc';
import { useDeviceStore } from '../stores/deviceStore';
import { getPool } from '../mqtt/pool';
import type { CommandResult } from '../mqtt/types';

export function useRpcCommand(): {
  sendCommand: (method: string, payload?: object) => Promise<CommandResult>;
} {
  const sendCommand = useCallback(async (method: string, payload?: object) => {
    const selectedId = useDeviceStore.getState().selectedId;
    if (!selectedId) {
      throw new Error('未选中设备');
    }
    const pool = getPool();
    return sendRpc(pool, selectedId, method, payload);
  }, []);

  return { sendCommand };
}
