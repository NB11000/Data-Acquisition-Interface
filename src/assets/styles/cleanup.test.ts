import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

const projectRoot = resolve(__dirname, '../../..');

describe('冗余目录已清理', () => {
  it('src/styles/ 目录已删除', () => {
    expect(existsSync(resolve(projectRoot, 'src/styles'))).toBe(false);
  });

  it('src/components/layout/ 目录已删除', () => {
    expect(existsSync(resolve(projectRoot, 'src/components/layout'))).toBe(false);
  });
});
