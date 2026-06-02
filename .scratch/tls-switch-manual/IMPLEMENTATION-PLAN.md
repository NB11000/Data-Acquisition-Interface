# Implementation Plan: TLS 开关手动控制 + 扩展协议前缀

> **Parent**: [PRD](./PRD.md)
> **Date**: 2026-06-01

## Modules

| # | Module | File | Responsibility |
|---|--------|------|----------------|
| M1 | **Server Modal** | `src/components/modals/MqttServerModal.tsx` | TLS 开关手动化、brokerUrl 四前缀校验、保存时双向一致性校验 |

## Interfaces

### MqttServerModal — 变更点

| 变更 | 旧 | 新 |
|------|-----|-----|
| TLS Switch | `disabled`，自动跟随 brokerUrl | 手动控制，默认 OFF |
| 编辑模式初始化 | `tlsEnabled = brokerUrl.startsWith('mqtts://')` | `tlsEnabled = !!server.caCert` |
| brokerUrl 前缀正则 | `/^mqtts?:\/\/.+/` | `/^(mqtts?|wss?):\/\/.+/` |
| 保存时校验 | 无 | 双向：ON→加密协议 / OFF→非加密协议 |

## Data Flow

### Happy path: 用户添加 WSS 服务器

```
用户输入 brokerUrl "wss://broker.example.com", port 8083
→ 手动拨动 TLS 开关 → ON
→ CA 证书 Upload 变为可用 → 上传 .pem
→ 保存时校验：TLS ON + brokerUrl "wss://..." → 通过
→ 组装 MqttServer（caCert 含证书内容）
→ URL: "wss://broker.example.com:8083" → mqtt.js WebSocket 建连
```

### Error path: TLS 开关与 URL 不一致

```
用户输入 brokerUrl "mqtt://broker.local", port 1883
→ 手动拨动 TLS 开关 → ON
→ 保存 → 校验失败
→ 弹出错误："TLS 已开启，Broker 地址必须以 mqtts:// 或 wss:// 开头"
→ 用户修正 brokerUrl 或关闭 TLS 开关后重试
```

### Edge case: 编辑已有服务器

```
server = { brokerUrl: "mqtts://old.example.com", caCert: "-----BEGIN..." }
→ 打开编辑 → caCert 非空 → TLS 开关初始化为 ON
→ CA 证书已上传，Upload 显示已有文件
```

```
server = { brokerUrl: "mqtts://old.example.com", caCert: undefined }
→ 打开编辑 → caCert 为空 → TLS 开关初始化为 OFF
→ 用户若保持 OFF 不变 → 保存时校验：OFF + mqtts:// → 报错
→ 用户必须手动：开 TLS 或改 brokerUrl 为 mqtt://
```

## Key Technical Decisions

| Decision | Choice | Why |
|----------|--------|-----|
| TLS 手动控制 | 用户主动开关 | TLS 是用户的显式意图，不应由 URL 推导 |
| 编辑模式按 caCert 初始化 | 有证书 = ON | 证书是最可靠的 TLS 启用标志；无证书的 mqtts:// 服务器让用户在矛盾中手动修正 |
| 保存时双向校验 | ON→加密 / OFF→非加密 | 杜绝 TLS 开关与 brokerUrl 协议不一致的脏数据 |
| 扩展 ws/wss 前缀 | 正则 `(mqtts?\|wss?)` | mqtt.js 原生支持，零成本增加 WebSocket 通道 |
| connectionFactory 不变 | 直接透传 brokerUrl | mqtt.js 内部根据 URL 前缀自选传输层 |

## Test Strategy

UI 表单校验逻辑，无独立可测模块。手动验证覆盖以下路径：

- 新建/编辑模式下 TLS 开关初始化
- TLS 开关联动 CA 证书上传 disabled
- 四种协议前缀的正则校验
- 端口禁止校验
- 保存时双向一致性校验（4 种组合：ON+加密✓ / ON+非加密✗ / OFF+非加密✓ / OFF+加密✗）

## Vertical Slice Design

仅1个切片：修改 `MqttServerModal.tsx`。

**Dependencies**: 依赖 `.scratch/remove-tls-from-server/` 的 Infrastructure 变更（已完成）。
