import { describe, it, expect } from 'vitest';
import type { CommandResult } from './types';

describe('CommandResult 类型', () => {
  it('应包含可选的 data 字段，支持存储任意配置数据', () => {
    const payload = { deviceId: 0, sampleRate: 1000 };

    const result: CommandResult = {
      success: true,
      code: 'OK',
      message: '配置读取成功',
      data: payload,
      timestamp: new Date().toISOString(),
    };

    expect(result.data).toBeDefined();
    expect(result.data).toEqual(payload);
  });

  it('data 字段为可选，不传时不应报错', () => {
    const result: CommandResult = {
      success: true,
      code: 'OK',
      message: '操作成功',
      timestamp: new Date().toISOString(),
    };

    expect(result.success).toBe(true);
    expect(result.data).toBeUndefined();
  });
});
