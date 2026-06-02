# 实施计划：默认暗色主题 + 主题系统统一

## 模块

| 模块 | 职责 |
|------|------|
| ThemeSwitch | 主题切换 UI 控件，localStorage 持久化读写，默认暗色 |
| App | React 根组件，初始化 isDark 与 ThemeSwitch 同源，同步 Ant Design ConfigProvider |
| variables.css | 统一的 27 变量 CSS 设计令牌（`:root` 浅色 + `body.dark-theme` 暗色） |
| global.css | 全局基础样式 + 滚动条样式 |
| Navbar | 顶部导航栏，内嵌 ThemeSwitch 替代内联 Switch |
| 样式引用层 | 8 个 CSS Module + 若干 inline style，变量名对齐 `--app-*` |
| 冗余清理 | 删除 `src/styles/` 和 `src/components/layout/` |

## 接口

### ThemeSwitch ↔ localStorage

```
STORAGE_KEY = 'app-theme'
值域: 'dark' | 'light' | null（视为 'dark'）
读取: localStorage.getItem(STORAGE_KEY) !== 'light'
写入: localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light')
```

### App ↔ ThemeSwitch（间接，通过 localStorage）

```
两者共享同一 STORAGE_KEY，各自独立读取，保证首帧一致。
MutationObserver 保留作为同步兜底。
```

### variables.css ↔ 组件

```
所有组件通过 var(--app-*) 引用，不再使用无前缀变量。
27 个变量均为必选，缺失会导致 fallback 为浏览器默认值。
```

## 数据流

### 首次访问（localStorage 空）

```
页面加载 → ThemeSwitch 初始化 dark=true → useEffect 设置 body.dark-theme
        → App 初始化 isDark=true（同逻辑读取 localStorage）→ ConfigProvider darkAlgorithm
        → CSS :root 变量被 body.dark-theme 覆盖 → 全页面暗色渲染
```

### 用户切换主题

```
点击 Switch → ThemeSwitch setDark(!prev) → useEffect 写入 localStorage + toggle body class
        → MutationObserver 检测 body class 变化 → App setState isDark → ConfigProvider 切换
        → CSS 变量自动级联更新所有 var() 引用
```

### 用户刷新（已有偏好）

```
localStorage['app-theme']='light'
页面加载 → ThemeSwitch 初始化 dark=false → NO body.dark-theme
        → App 初始化 isDark=false → ConfigProvider defaultAlgorithm
        → 全页面浅色渲染
```

### 迁移变量引用

```
编译时修改：所有 var(--text-*) → var(--app-text-*)
            var(--statusbar-*) → var(--app-control-bar-*)
            var(--chart-card-bg) → var(--app-card-bg)
            var(--navbar-text) → var(--app-nav-text)
            var(--app-navbar-bg) → var(--app-nav-bg)
```

## 关键技术决定

1. **默认值判断逻辑**：`!== 'light'` 而非 `=== 'dark'`，天然覆盖 null/undefined/意外值三种情况
2. **同源同步去闪烁**：App.tsx 的 useState initializer 是同步的，先于 useEffect，确保首帧即为正确主题
3. **变量全量替换**：不保留旧变量名别名，强制统一。一次 build 即可发现遗漏引用
4. **滚动条样式合并**：`--app-scrollbar-thumb/track` 从 `src/styles/global.css` 迁移到生效的 `global.css`

## 测试策略

| 模块 | 测试类型 | 聚焦点 |
|------|----------|--------|
| ThemeSwitch | 单元测试 | localStorage 空 → dark；light → 非 dark；写入验证 |
| App | 单元测试 | isDark 初始化与 localStorage 一致；MutationObserver 同步 |
| variables.css | 快照测试 | 浅色 :root 和暗色 body.dark-theme 均含全部 27 个变量，无遗漏 |
| 样式引用 | E2E 人工 | 各页面在暗/亮模式下视觉走查 |

## 垂直切片设计

| # | 切片 | 依赖 | 改动文件 |
|---|------|------|----------|
| 1 | CSS 变量统一与扩展 | 无 | `variables.css`, `global.css` |
| 2 | ThemeSwitch 默认暗色 + App 同步 | #1 | `ThemeSwitch.tsx`, `App.tsx` |
| 3 | Navbar 整合 ThemeSwitch | #2 | `Navbar.tsx` |
| 4 | 样式变量名迁移 | #1 | 8 个 CSS Module + 内联 style 文件 |
| 5 | 冗余代码清理 | #4 | 删除 `src/styles/`、`src/components/layout/` |
