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

删除冗余目录和文件：
- `src/styles/` 整个目录（含 `variables.css`、`global.css`）
- `src/components/layout/` 整个目录（含 `AppLayout.tsx`、`Navbar.tsx`、`Sidebar.tsx`）

这些目录未被任何文件 import 引用，已在前期探索中确认安全删除。

## 验收标准

- [ ] `src/styles/` 目录不存在
- [ ] `src/components/layout/` 目录不存在
- [ ] `pnpm build` 成功，无 import 错误
- [ ] 页面功能正常（路由、导航、图表、数据流不受影响）

## 阻塞

- [#04-variable-name-migration](./04-variable-name-migration.md)（冗余文件中的变量引用需先迁移完毕，确保删除后无残留引用）
