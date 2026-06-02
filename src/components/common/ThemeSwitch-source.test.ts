import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const themeSwitchPath = resolve(__dirname, 'ThemeSwitch.tsx');
const appPath = resolve(__dirname, '../../App.tsx');

describe('ThemeSwitch 默认值变更', () => {
  const content = readFileSync(themeSwitchPath, 'utf-8');

  it('初始化默认逻辑为 !== "light" （无 localStorage 时暗色）', () => {
    expect(content).toMatch(/localStorage\.getItem.*!==\s*'light'/);
  });

  it('不再使用 === "dark" 作为默认判断', () => {
    expect(content).not.toMatch(/getItem.*===\s*'dark'/);
  });
});

describe('App.tsx isDark 初始化与 ThemeSwitch 同源', () => {
  const content = readFileSync(appPath, 'utf-8');

  it('isDark 初始值从 localStorage["app-theme"] 读取', () => {
    expect(content).toMatch(/useState\(\s*\(\)\s*=>\s*localStorage/);
  });
});
