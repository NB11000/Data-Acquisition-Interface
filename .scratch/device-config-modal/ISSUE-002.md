# ISSUE-002: 配置类型定义 + 下拉选项常量

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

在 `ConfigModal.tsx` 中定义四种配置的 TypeScript 接口和下拉选项常量数组：

**接口**（与 MQTT 文档 §2.5 严格对齐）：
- `CaptureCardConfig` — 7 字段 (deviceId, syncChannelIndex, sampleRate, clockSourceIndex, halfFullThreshold, triggerSourceIndex, rangeIndex)
- `RadarConfig` — 4 字段 (laserPower, laserModulationFrequency, serialPort, baudRate)
- `LidarAlgorithmConfig` — 11 字段 (双精度算法参数)
- `PersistenceSettings` — 1 字段 (dataDirectory)

**下拉选项常量**：
- `SYNC_CHANNEL_OPTIONS` — 通道1/通道2/双通道
- `CLOCK_SOURCE_OPTIONS` — 内时钟/外时钟
- `HALF_FULL_OPTIONS` — 2M~16K (8档)
- `TRIGGER_SOURCE_OPTIONS` — 外触发/软触发
- `RANGE_OPTIONS` — ±5V/±10V
- `BAUD_RATE_OPTIONS` — 常用波特率

## Acceptance criteria

- [ ] 四种配置接口的字段名、类型与 MQTT 文档完全一致
- [ ] 所有下拉选项常量含 label 和 value
- [ ] TypeScript 编译无类型错误

## Blocked by

ISSUE-001（引用 `CommandResult` 类型的 `data` 字段时需其已存在）
