# PRD：默认暗色主题 + 主题系统统一

## 标签

`needs-triage`

## 问题陈述

当前系统首次加载默认为浅色主题。用户在首次访问时看到浅色界面，需要手动切换才能进入暗色模式。且主题切换由旧版 Navbar 内联 Switch 直接操纵 DOM，无 localStorage 持久化——用户每次刷新页面都丢失偏好。

此外，CSS 变量未经统一命名（存在两套前缀混用），冗余的 `src/styles/` 和 `src/components/layout/` 目录残留。

## 解决方案

将默认主题改为暗色：首次访问（无 localStorage 记录时）默认为暗色主题，之后用户手动切换的偏好通过 localStorage 持久化，刷新后保留。

同步完成主题系统统一：引入带 localStorage 持久化的 ThemeSwitch 组件替换旧版内联 Switch，统一 CSS 变量为 `--app-*` 命名空间，清理冗余代码。

## 用户故事

1. 作为首次访问的用户，我希望页面默认显示暗色主题，避免首次看到刺眼的亮色界面后再手动切换
2. 作为日常用户，我上次切换到浅色/暗色后刷新页面，希望我的选择被记住不用重新切换
3. 作为开发者，我希望 CSS 变量有统一的 `--app-*` 命名前缀，避免新老变量混用导致的维护困惑
4. 作为开发者，我希望代码库中没有冗余的 `src/styles/` 和 `src/components/layout/` 目录，降低维护成本

## 实现决定

### 模块划分

| 模块 | 职责 | 改动类型 |
|------|------|----------|
| ThemeSwitch | 主题切换开关，localStorage 持久化，首次默认暗色 | 修改默认值 |
| App | 根组件，同步 isDark 初始化与 ThemeSwitch 同源 | 修改初始化逻辑 |
| CSS Variables | 设计令牌，26 个 `--app-*` 变量，支持亮/暗双套 | 重构合并 |
| Global Styles | 基础样式，补充滚动条样式 | 扩展 |
| Navbar | 顶部导航，引入 ThemeSwitch 替换内联 Switch | 整合 |
| 样式引用层 | 8 个 CSS Module + 内联 style，变量名全部对齐 | 迁移 |
| 冗余目录 | `src/styles/`、`src/components/layout/` | 删除 |

### 关键决定

1. **默认值：** 无 localStorage 时默认 `dark`（`localStorage.getItem('app-theme') !== 'light'`）
2. **同源同步：** App.tsx 和 ThemeSwitch 均从 `localStorage['app-theme']` 读取初始状态，消除首帧闪烁
3. **变量命名：** 全部统一为 `--app-*` 前缀（27 个变量含 24 个标准 + 3 个无对应补充）
4. **Navbar 保留：** Tabs 导航、Logo、Avatar 全部保留，仅替换 Switch 区域
5. **Switch 映射：** ON（checked）= 暗色 / OFF = 浅色，ON 侧显示月亮图标

### 变量名映射表

| 旧名 | 新名 |
|------|------|
| `--app-bg-color` | 保留不变 |
| `--app-content-bg` | 保留不变 |
| `--app-sidebar-bg` | 保留不变 |
| `--app-navbar-bg` → | `--app-nav-bg` |
| `--navbar-text` → | `--app-nav-text` |
| `--text-primary` → | `--app-text-primary` |
| `--text-secondary` → | `--app-text-secondary` |
| `--statusbar-bg` → | `--app-control-bar-bg` |
| `--statusbar-border` → | `--app-control-bar-border` |
| `--chart-card-bg` → | `--app-card-bg` |
| `--chart-card-border-top` → | `--app-chart-card-border-top`（保留） |
| `--chart-card-padding` → | `--app-chart-card-padding`（保留） |
| `--device-card-hover` → | `--app-device-card-hover`（保留） |
| 新增 | `--app-nav-active`、`--app-sidebar-border`、`--app-card-border`、`--app-card-shadow`、`--app-text-hint`、`--app-control-bar-shadow`、`--app-status-online`、`--app-status-offline`、`--app-status-warning`、`--app-banner-bg`、`--app-banner-border`、`--app-banner-text`、`--app-scrollbar-thumb`、`--app-scrollbar-track` |

## 测试决策

- 单元测试 ThemeSwitch 的初始状态逻辑（localStorage 空 → dark；localStorage='light' → light）
- 单元测试 App 的 isDark 初始化（与 ThemeSwitch 同源同步）
- 快照测试 CSS 变量完整性（浅色模式和暗色模式均含全部 27 个变量）
- 不测试：CSS Module class 应用效果、MutationObserver 行为、Ant Design 组件渲染

## 排除范围

- 不新增主题切换之外的任何 UI 变更
- 不改动 WaveformChart 的独立 MutationObserver 主题同步逻辑
- 不增加"跟随系统主题"功能
- 不修改 index.html 结构
- 不涉及 ADR（纯 UI 层变更，低风险、易回滚）
