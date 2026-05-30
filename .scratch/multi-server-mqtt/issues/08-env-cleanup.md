# Issue 8: 环境变量清理

## Execution Rules

> **此 Issue 为纯删除操作，不适用 TDD 流程。** 完成后通过全局搜索和 `npm run dev` 验证。
>
> - 删除操作无需测试——不新增任何逻辑
> - 验证方式：全局 grep 确认零残留引用，Mock 模式下 `npm run dev` 正常启动

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
