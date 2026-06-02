## 执行规则

> **此 Issue 执行顺序不可变更，必须遵循 TDD 红绿重构循环：**
>
> **1. RED** — 先写一个测试，确认测试 FAIL。禁止一次写多个测试。
> **2. GREEN** — 写最少代码让当前测试 PASS。禁止预判未来测试。
> **3. REFACTOR** — 消除重复、深化模块。禁止 RED 期间重构。
>
> **硬禁止：**
> - 禁止"先全部实现再补测试"（水平切片反模式）
> - 禁止跳过 RED 直接写 GREEN
> - 测试必须通过公共接口验证行为，不耦合实现细节
> - 每次循环只一个测试 → 一个实现，垂直切片推进

## 父级

[实施计划](../IMPLEMENTATION-PLAN.md)

## 构建内容

将 8 个 CSS Module 文件和所有内联 style 中的旧变量名迁移为新的 `--app-*` 命名。确保所有引用均在 `variables.css` 中有对应变量定义。

### 老新映射清单

| 旧变量 | 新变量 |
|--------|--------|
| `--app-bg-color` | `--app-bg-color`（不变） |
| `--app-content-bg` | `--app-content-bg`（不变） |
| `--app-sidebar-bg` | `--app-sidebar-bg`（不变） |
| `--app-navbar-bg` | `--app-nav-bg` |
| `--navbar-text` | `--app-nav-text` |
| `--text-primary` | `--app-text-primary` |
| `--text-secondary` | `--app-text-secondary` |
| `--statusbar-bg` | `--app-control-bar-bg` |
| `--statusbar-border` | `--app-control-bar-border` |
| `--chart-card-bg` | `--app-card-bg` |
| `--chart-card-border-top` | `--app-chart-card-border-top` |
| `--chart-card-padding` | `--app-chart-card-padding` |
| `--device-card-hover` | `--app-device-card-hover` |

### 涉及文件

- `src/components/Navbar.module.css`
- `src/components/Sidebar.module.css`
- `src/components/DeviceCard.module.css`
- `src/pages/Dashboard/components/ChartCard.module.css`
- `src/pages/Dashboard/StatusControlBar.module.css`（如存在）
- `src/pages/Settings/Settings.module.css`
- `src/components/modals/AddDeviceModal.module.css`
- `src/layouts/AppLayout.module.css`
- `src/assets/styles/antd-overrides.css`
- `src/pages/Logs/index.tsx`（内联 style）
- `src/pages/History/index.tsx`（内联 style）
- `src/pages/Alerts/index.tsx`（内联 style）
- `src/components/ErrorBoundary.tsx`（内联 style）

## 验收标准

- [ ] 所有旧变量名（`--text-primary`/`--text-secondary`/`--statusbar-*`/`--chart-card-*`/`--app-navbar-bg`/`--navbar-text`/`--device-card-hover`）在代码库中不再出现
- [ ] `pnpm build` 无 CSS/TypeScript 错误
- [ ] 暗色模式和浅色模式下视觉走查：Navbar、Sidebar、ChartCard、StatusBar、DeviceCard、Settings、Modal 均正确显示

## 阻塞

- [#01-css-variables-unified](./01-css-variables-unified.md)（新变量必须先定义）
