import { MqttClientManager } from './client';

type EventHandler = (topic: string, payload: Buffer) => void;

interface RouteEntry {
  pattern: RegExp;
  handler: EventHandler;
}

export class TopicRouter {
  private routes: RouteEntry[] = [];
  private cleanupFn: (() => void) | null = null;

  /** 注册路由: pattern 为包含捕获组的正则表达式 */
  on(pattern: RegExp, handler: EventHandler): void {
    this.routes.push({ pattern, handler });
  }

  /** 启动路由监听 */
  start(): void {
    const client = MqttClientManager.getInstance();
    this.cleanupFn = client.onMessage((topic, payload) => {
      for (const route of this.routes) {
        if (route.pattern.test(topic)) {
          route.handler(topic, payload);
          return; // 首个匹配
        }
      }
    });
  }

  /** 停止路由监听 */
  stop(): void {
    this.cleanupFn?.();
    this.cleanupFn = null;
    this.routes = [];
  }
}
