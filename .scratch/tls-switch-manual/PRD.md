# PRD: TLS 开关改为手动控制 + 扩展协议前缀

> **状态**: needs-triage
> **日期**: 2026-06-01

## Problem Statement

当前 MqttServerModal 的 TLS 开关是 disabled 状态，自动根据 brokerUrl 前缀（`mqtts://`）显示 ON/OFF，用户无法手动控制。这导致两个体验问题：

1. **TLS 意图不明确**：用户当前需要开启 TLS，但只能通过修改 brokerUrl 前缀来间接表达，操作路径不直观。
2. **协议支持受限**：brokerUrl 校验仅接受 `mqtt://` 和 `mqtts://` 前缀，不支持 WebSocket 传输（`ws://` / `wss://`）。

## Solution

TLS 开关改为用户手动控制，不再自动跟随 brokerUrl。brokerUrl 校验扩展为接受四种前缀：`mqtt://`、`mqtts://`、`ws://`、`wss://`。保存时进行双向一致性校验：TLS 开关 ON 时 brokerUrl 必须为加密协议（`mqtts://` / `wss://`），OFF 时必须为非加密协议（`mqtt://` / `ws://`）。

## User Stories

1. As a user, I want to manually toggle the TLS switch in the server form, so that I can explicitly indicate whether this connection uses encryption.
2. As a user, I want the CA certificate upload to be enabled when I switch TLS ON, so that I can upload my server's CA certificate.
3. As a user, I want to use WebSocket transport (`ws://` or `wss://`) in addition to native MQTT, so that I can connect to brokers that expose WebSocket endpoints.
4. As a user, I want the form to reject my submission if the TLS switch contradicts the broker URL protocol, so that I don't create inconsistent configurations.
5. As a user editing an existing server, I want the TLS switch to initialize based on whether the server has a CA certificate, so that I don't need to re-configure TLS settings.
6. As a user, I want clear error messages explaining why my TLS switch and broker URL are incompatible, so that I can fix the issue quickly.

## Implementation Decisions

### UI Behavior

- **TLS Switch**: manually toggled by user. NOT disabled. NOT auto-following brokerUrl input.
- **Initialization (edit mode)**: TLS switch ON if server has `caCert` (non-empty), OFF otherwise.
- **Initialization (new mode)**: TLS switch OFF by default.
- **CA cert Upload**: `disabled={!tlsEnabled}`. Only available when TLS switch is ON.

### Form Validation

- **brokerUrl prefix**: must match `/^(mqtts?|wss?):\/\/.+/` — accepts `mqtt://`, `mqtts://`, `ws://`, `wss://`
- **brokerUrl port restriction**: must not contain `:\d+` pattern (user prompted to use dedicated port field)
- **Save-time bidirectional check**:
  - TLS ON → brokerUrl must start with `mqtts://` or `wss://`; else error "TLS 已开启，Broker 地址必须以 mqtts:// 或 wss:// 开头"
  - TLS OFF → brokerUrl must start with `mqtt://` or `ws://`; else error "TLS 未开启，Broker 地址必须以 mqtt:// 或 ws:// 开头"

### No backend changes

- `connectionFactory`, `connectionPool`, `pool.ts`, `serverStore` — all unchanged
- mqtt.js 5.x natively supports ws/wss URLs

## Testing Decisions

### What to test

This change is purely UI form validation — manual verification is sufficient. No new unit tests.

### Verification checklist

- [ ] New server form: TLS switch default OFF, can toggle ON/OFF freely
- [ ] Edit server with caCert: TLS switch initializes ON
- [ ] Edit server without caCert: TLS switch initializes OFF
- [ ] TLS ON → CA cert upload enabled; TLS OFF → disabled
- [ ] Save with TLS ON + `mqtt://` prefix → blocked with error message
- [ ] Save with TLS OFF + `mqtts://` prefix → blocked with error message
- [ ] Save with TLS ON + `wss://` prefix → accepted
- [ ] Save with TLS OFF + `ws://` prefix → accepted
- [ ] brokerUrl `host.com` (no prefix) → blocked by prefix regex
- [ ] brokerUrl `mqtt://host:1883` (contains port) → blocked by port validator

## Out of Scope

- Changing the underlying MQTT connection logic (factory unchanged)
- Adding ws/wss support to mock mode
- TLS certificate validation (e.g., checking cert expiry)

## Further Notes

- This is a single-file change to `MqttServerModal.tsx` only
- Builds on the prior "remove tls field" refactoring completed in `.scratch/remove-tls-from-server/`
