import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

function extractVarNames(css: string, blockLabel: string): string[] {
  const regex = /\B(--[\w-]+)\s*:/g;
  const matches = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(css)) !== null) {
    matches.add(match[1]);
  }
  return [...matches].sort();
}

const cssPath = resolve(__dirname, 'variables.css');

const css = readFileSync(cssPath, 'utf-8');

describe('variables.css — 变量命名空间与完整性', () => {

  it('所有变量均为 --app-* 前缀，无混用命名', () => {
    const allVars = extractVarNames(css, '');
    const nonPrefixed = allVars.filter((v) => !v.startsWith('--app-'));
    expect(nonPrefixed).toEqual([]);
  });

  it(':root 块包含全部 27 个设计令牌变量', () => {
    const rootMatch = css.match(/:root\s*\{([^}]*)\}/s);
    expect(rootMatch).not.toBeNull();
    const rootVars = extractVarNames(rootMatch![0], ':root');
    expect(rootVars).toHaveLength(27);
    expect(rootVars).toMatchInlineSnapshot(`
      [
        "--app-banner-bg",
        "--app-banner-border",
        "--app-banner-text",
        "--app-bg-color",
        "--app-card-bg",
        "--app-card-border",
        "--app-card-shadow",
        "--app-chart-card-border-top",
        "--app-chart-card-padding",
        "--app-content-bg",
        "--app-control-bar-bg",
        "--app-control-bar-border",
        "--app-control-bar-shadow",
        "--app-device-card-hover",
        "--app-nav-active",
        "--app-nav-bg",
        "--app-nav-text",
        "--app-scrollbar-thumb",
        "--app-scrollbar-track",
        "--app-sidebar-bg",
        "--app-sidebar-border",
        "--app-status-offline",
        "--app-status-online",
        "--app-status-warning",
        "--app-text-hint",
        "--app-text-primary",
        "--app-text-secondary",
      ]
    `);
  });

  it('body.dark-theme 块包含与 :root 完全相同的 27 个变量', () => {
    const darkMatch = css.match(/body\.dark-theme\s*\{([^}]*)\}/s);
    expect(darkMatch).not.toBeNull();
    const darkVars = extractVarNames(darkMatch![0], 'dark-theme');

    const rootMatch = css.match(/:root\s*\{([^}]*)\}/s);
    const rootVars = extractVarNames(rootMatch![0], ':root');

    expect(darkVars).toEqual(rootVars);
  });

  it(':root 与 dark-theme 中 --app-bg-color 值不同（浅色 vs 暗色）', () => {
    const rootBg = css.match(/:root\s*\{[^}]*--app-bg-color:\s*([^;]+);/s)?.[1]?.trim();
    const darkBg = css.match(/body\.dark-theme\s*\{[^}]*--app-bg-color:\s*([^;]+);/s)?.[1]?.trim();
    expect(rootBg).toBeTruthy();
    expect(darkBg).toBeTruthy();
    expect(rootBg).not.toBe(darkBg);
  });
});
