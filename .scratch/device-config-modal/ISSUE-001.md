# ISSUE-001: RPC 层准备 — CommandResult 扩展 + Mock 补齐

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

**类型层**：`CommandResult` 接口新增 `data?: unknown` 字段，使配置 RPC 读写能将自定义数据体放入响应。

**Mock 层**：`mockRpc.ts` 的 `handleMockRpc` switch 补齐 9 个配置方法的 mock 分支，返回带 `data` 字段的 `CommandResult`：
- `collector-config-read` / `collector-config-update` / `collector-config-default`
- `laser-config-read` / `laser-config-update`
- `lidar-config-read` / `lidar-config-update`
- `persistence-config-read` / `persistence-config-update`

读方法返回硬编码默认配置对象，写方法回显请求 payload。

## Acceptance criteria

- [ ] `CommandResult` 类型含 `data?: unknown`，现有代码无类型错误
- [ ] Mock 模式下发 `collector-config-read` RPC 返回带 `data` 的成功响应
- [ ] Mock 模式下发 `laser-config-read` RPC 返回带 `data` 的成功响应
- [ ] Mock 模式下发 `lidar-config-read` RPC 返回带 `data` 的成功响应
- [ ] Mock 模式下发 `persistence-config-read` RPC 返回带 `data` 的成功响应
- [ ] 四个 update 方法在 mock 下回显 payload 到 `data`
- [ ] `collector-config-default` mock 返回默认配置
- [ ] 现有 mockRpc default 分支仍正确处理未知方法

## Blocked by

无 — 可立即开始
