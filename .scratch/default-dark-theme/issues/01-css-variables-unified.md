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

将 `src/assets/styles/variables.css` 重构为统一的 27 变量 CSS 设计令牌，全部使用 `--app-*` 前缀。`:root` 定义浅色变量，`body.dark-theme` 覆盖为暗色变量。同步扩展 `global.css` 补充滚动条样式。

## 验收标准

- [ ] `variables.css` 中 `:root` 块包含 27 个 `--app-*` 变量，变量名全量覆盖实施计划中的映射表
- [ ] `variables.css` 中 `body.dark-theme` 块包含与 `:root` 完全对应的 27 个暗色覆盖变量
- [ ] `global.css` 包含 `::-webkit-scrollbar` 滚动条样式，引用 `--app-scrollbar-thumb` 和 `--app-scrollbar-track`
- [ ] 快照测试验证浅色和暗色变量集均为 27 个、无遗漏

## 阻塞

无 — 可立即开始
