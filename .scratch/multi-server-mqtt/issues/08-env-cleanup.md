# Issue 8: 环境变量清理

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

## Parent

[IMPLEMENTATION-PLAN.md](../IMPLEMENTATION-PLAN.md) — Slice 8

## What to build

移除废弃的环境变量引用：删除 `.env` 中的 `VITE_BROKER_URL`、`VITE_BROKER_USERNAME`、`VITE_BROKER_PASSWORD`、`VITE_DEFAULT_MACHINE_ID`，清理代码中所有引用。仅保留 `VITE_MQTT_MODE`。

## Acceptance criteria

- [ ] `.env` 文件：删除 `VITE_BROKER_URL`、`VITE_BROKER_USERNAME`、`VITE_BROKER_PASSWORD`、`VITE_DEFAULT_MACHINE_ID` 行
- [ ] `src/env.ts`：删除对应的 `BROKER_URL`、`BROKER_USERNAME`、`BROKER_PASSWORD` export
- [ ] 全局搜索 `VITE_BROKER_URL|VITE_BROKER_USERNAME|VITE_BROKER_PASSWORD|VITE_DEFAULT_MACHINE_ID` → src/ 目录下零匹配
- [ ] `VITE_MQTT_MODE` 仍然存在且功能正常（决定注入 Mock 或 Real 工厂）
- [ ] `npm run dev` 可正常启动（Mock 模式不依赖任何 env broker 配置）

## Blocked by

Issue 1-7 (所有依赖 env vars 的代码已改造完毕)
