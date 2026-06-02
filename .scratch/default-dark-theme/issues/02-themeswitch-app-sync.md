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

修改 `ThemeSwitch.tsx`——初始化时无 localStorage 记录默认返回 `dark`（当前默认 `false`）。修改 `App.tsx`——`isDark` 初始值从 `document.body.classList.contains('dark-theme')` 改为从 `localStorage.getItem('app-theme')` 读取，与 ThemeSwitch 同源同步，消除首帧闪烁。

## 验收标准

- [ ] ThemeSwitch：`localStorage` 为空时 `dark === true`，页面渲染暗色
- [ ] ThemeSwitch：`localStorage['app-theme'] === 'light'` 时 `dark === false`
- [ ] App：isDark 初始值与 `localStorage.getItem('app-theme')` 一致（null → true, 'dark' → true, 'light' → false）
- [ ] 首次加载无闪烁（App 和 ThemeSwitch 首帧状态一致）
- [ ] 单元测试覆盖上述三种初始状态场景

## 阻塞

- [#01-css-variables-unified](./01-css-variables-unified.md)（CSS 变量必须先统一，否则暗色模式下渲染效果不正确）
