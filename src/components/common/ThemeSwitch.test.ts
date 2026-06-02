import { describe, it, expect, beforeEach } from 'vitest';

const STORAGE_KEY = 'app-theme';

function mockLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => {
      return store[key] ?? null;
    },
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    clear: () => {
      store = {};
    },
  };
}

function getIsDark(ls: ReturnType<typeof mockLocalStorage>): boolean {
  const val = ls.getItem(STORAGE_KEY);
  return val !== 'light';
}

function setIsDark(ls: ReturnType<typeof mockLocalStorage>, dark: boolean): void {
  ls.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
}

describe('ThemeSwitch + App 主题状态同步', () => {
  let ls: ReturnType<typeof mockLocalStorage>;

  beforeEach(() => {
    ls = mockLocalStorage();
  });

  describe('getIsDark — 与 App.tsx / ThemeSwitch 初始化逻辑一致', () => {
    it('localStorage 为空时默认暗色', () => {
      expect(getIsDark(ls)).toBe(true);
    });

    it('localStorage 为 "light" 时返回浅色', () => {
      ls.setItem(STORAGE_KEY, 'light');
      expect(getIsDark(ls)).toBe(false);
    });

    it('localStorage 为 "dark" 时返回暗色', () => {
      ls.setItem(STORAGE_KEY, 'dark');
      expect(getIsDark(ls)).toBe(true);
    });

    it('localStorage 为意外值时安全降级为暗色', () => {
      ls.setItem(STORAGE_KEY, 'garbage');
      expect(getIsDark(ls)).toBe(true);
    });
  });

  describe('setIsDark', () => {
    it('dark=true 写入 "dark"', () => {
      setIsDark(ls, true);
      expect(ls.getItem(STORAGE_KEY)).toBe('dark');
    });

    it('dark=false 写入 "light"', () => {
      setIsDark(ls, false);
      expect(ls.getItem(STORAGE_KEY)).toBe('light');
    });
  });

  describe('往返测试', () => {
    it('写入后读取一致', () => {
      setIsDark(ls, true);
      expect(getIsDark(ls)).toBe(true);

      setIsDark(ls, false);
      expect(getIsDark(ls)).toBe(false);
    });
  });
});
