// 模块级桥接：MQTT 回调 → React 组件树重渲染
// useMqttConnect 注册回调，外部模块（router.ts、sendStateRpcWithRetry）触发

type StateUpdateFn = (state: Record<string, unknown>) => void;
let notify: StateUpdateFn | null = null;

export function setBridgeCallback(fn: StateUpdateFn | null) {
  notify = fn;
}

export function triggerSystemStateUpdate(state: Record<string, unknown>) {
  notify?.(state);
}
