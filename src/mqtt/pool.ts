import createConnectionPool, { type ConnectionPool } from './connectionPool';
import { createDefaultFactory } from './connectionFactory';
import type { MqttServer } from '../stores/serverStore';
import { generateGuid } from '../utils/id';

let pool: ConnectionPool | null = null;

export function getPool(): ConnectionPool {
  if (!pool) {
    pool = createConnectionPool();
  }
  return pool;
}

export type { ConnectionPool };

/** 测试连接：用临时 client 尝试建连 */
export async function testConnection(
  brokerUrl: string,
  username: string,
  password: string,
  caCert?: string,
): Promise<boolean> {
  const factory = createDefaultFactory();
  const server: MqttServer = {
    id: generateGuid(),
    name: 'test',
    brokerUrl,
    username,
    password,
    connected: false,
    caCert,
  };
  const client = factory.createConnection(server);

  return new Promise<boolean>((resolve) => {
    const timeout = setTimeout(() => {
      client.end(true);
      resolve(false);
    }, 5000);

    client.onConnect = () => {
      clearTimeout(timeout);
      client.end(true);
      resolve(true);
    };

    client.connect();
    if (client.isConnected) {
      clearTimeout(timeout);
      resolve(true);
    }
  });
}
