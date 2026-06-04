# ISSUE-004: 配置读取功能 — 并发 RPC 读取 + 错误降级

> **状态**: needs-triage
> **Parent**: [IMPLEMENTATION-PLAN.md](./IMPLEMENTATION-PLAN.md)

## Execution Rules

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

## What to build

弹窗打开时读取配置的核心逻辑：

1. **并发读取**：`Promise.allSettled` 同时调用 4 个 RPC read 方法
2. **状态管理**：每个 Tab 维护 `LoadState`: `'loading'` | `'idle'` | `'error'`
3. **表单填充**：读取成功时 `form.setFieldsValue(result.data)`
4. **错误降级**：失败的 Tab 显示错误 Alert + "重试"按钮，成功的正常可用
5. **重试**：点击重试按钮 → 重新调该读方法 → 成功填充 / 失败维持 error
6. **loading 态**：Tab 内容区居中 Spin，读取完成后切换

不实现保存功能。

## Acceptance criteria

- [ ] 弹窗打开后自动发起 4 个 RPC 读取请求
- [ ] 全部成功 → 四个表单均正确填充设备当前值
- [ ] 部分失败 → 成功 Tab 正常显示数据，失败 Tab 显示错误 + 重试按钮
- [ ] 全部失败 → 四个 Tab 均显示错误 + 重试按钮
- [ ] 点击重试 → 重新发起该 Tab 的读取请求
- [ ] 读取期间 Tab 内容区显示 loading Spin
- [ ] 首次打开后已有数据的 Tab 不重复读取

## Blocked by

ISSUE-003（需要 Modal + Tabs + Form 框架）
