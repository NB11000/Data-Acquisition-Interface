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

修改 `src/components/Navbar.tsx`：移除内联 `<Switch>` + ☀️🌙 emoji，引入 `<ThemeSwitch />` 组件。保留 Tabs 导航、Logo、Avatar 不变。

## 验收标准

- [ ] Navbar 中不再包含内联 Switch 和 emoji 字符
- [ ] Navbar 中渲染 `<ThemeSwitch />` 组件
- [ ] Tabs 导航功能正常（路由切换不受影响）
- [ ] Logo 点击跳转 Dashboard 正常
- [ ] Avatar 保留显示

## 阻塞

- [#02-themeswitch-app-sync](./02-themeswitch-app-sync.md)（ThemeSwitch 默认值必须先改为暗色，Navbar 才能正确展示）
