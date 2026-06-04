# ISSUE-005: 配置保存功能 — 逐 Tab 表单校验 + RPC 写入

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

每个 Tab 底部各自的保存按钮 + 完整保存流程：

1. **表单字段完善**：每个 Tab 用对应的配置接口类型渲染 `Form.Item`，字段控件选择：
   - 枚举字段 → `<Select options={...} />`
   - 数值字段 → `<InputNumber min max step />`
   - 字符串字段 → `<Input />`
2. **校验规则**：`rules={[{ required: true, ... }]}` 针对各字段类型和范围
3. **保存按钮**：每个 Tab 底部 `<Button type="primary">保存</Button>`
4. **保存流程**：
   - `form.validateFields()` → 失败显示校验错误
   - 通过 → `sendCommand("xxx-config-update", formValues)`
   - 成功 → `message.success("保存成功")`
   - 失败 → `message.error(result.message)`
5. **保存 loading**：按钮 `loading` 态，防止重复提交

## Acceptance criteria

- [ ] 每个 Tab 有完整的表单字段，控件类型正确
- [ ] 必填字段为空时点击保存显示校验错误
- [ ] 数值字段输入超出 min/max 范围时校验不通过
- [ ] 校验通过后调用正确的 RPC update 方法，payload 与表单值一致
- [ ] 保存成功显示 "保存成功" 提示
- [ ] 保存失败显示后端返回的错误消息
- [ ] 保存期间按钮 loading，不可重复点击
- [ ] 采集卡、激光雷达、算法、持久化四个Tab各自独立保存

## Blocked by

ISSUE-004（需要读取功能先将表单填充，才能在此基础上编辑保存）
