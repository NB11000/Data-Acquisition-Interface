import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const navbarPath = resolve(__dirname, 'Navbar.tsx');

describe('Navbar 整合 ThemeSwitch', () => {
  const content = readFileSync(navbarPath, 'utf-8');

  it('引入 ThemeSwitch 组件', () => {
    expect(content).toMatch(/import\s+.*ThemeSwitch\s+from/);
  });

  it('渲染 <ThemeSwitch />', () => {
    expect(content).toMatch(/<ThemeSwitch\s*\/>/);
  });

  it('移除内联 Switch 组件', () => {
    expect(content).not.toMatch(/<Switch\s/);
  });

  it('移除 emoji 装饰字符', () => {
    expect(content).not.toMatch(/☀️|🌙/);
  });
});
