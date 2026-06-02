import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const OLD_VAR_MAP: Record<string, string> = {
  '--app-navbar-bg': '--app-nav-bg',
  '--navbar-text': '--app-nav-text',
  '--text-primary': '--app-text-primary',
  '--text-secondary': '--app-text-secondary',
  '--statusbar-bg': '--app-control-bar-bg',
  '--statusbar-border': '--app-control-bar-border',
  '--chart-card-bg': '--app-card-bg',
  '--chart-card-border-top': '--app-chart-card-border-top',
  '--chart-card-padding': '--app-chart-card-padding',
  '--device-card-hover': '--app-device-card-hover',
};

const projectRoot = resolve(__dirname, '../../..');

const CHECK_FILES = [
  'src/components/Navbar.module.css',
  'src/components/Sidebar.module.css',
  'src/components/DeviceCard.module.css',
  'src/components/ErrorBoundary.tsx',
  'src/components/modals/AddDeviceModal.module.css',
  'src/pages/Dashboard/components/ChartCard.module.css',
  'src/pages/Dashboard/StatusControlBar.module.css',
  'src/pages/Dashboard/components/WaveformChart.tsx',
  'src/pages/Settings/Settings.module.css',
  'src/pages/Logs/index.tsx',
  'src/pages/History/index.tsx',
  'src/pages/Alerts/index.tsx',
  'src/assets/styles/antd-overrides.css',
];

describe('样式变量名全部迁移到 --app-* 前缀', () => {
  Object.entries(OLD_VAR_MAP).forEach(([oldVar, newVar]) => {
    it(`${oldVar} → ${newVar}（源码中无残留）`, () => {
      const offending: string[] = [];
      for (const relPath of CHECK_FILES) {
        try {
          const content = readFileSync(resolve(projectRoot, relPath), 'utf-8');
          if (content.includes(oldVar)) {
            offending.push(relPath);
          }
        } catch {
          // skip
        }
      }
      expect(offending).toEqual([]);
    });
  });
});
