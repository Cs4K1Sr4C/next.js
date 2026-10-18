export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
}

/**
 * Turns `REDIS_URL` into the `{ host, port, ... }` shape accepted by both the
 * Nest Redis transport and BullMQ.
 */
export function redisConnectionOptions(
  url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
): RedisConnectionOptions {
  const parsed = new URL(url);
  const db = parsed.pathname.slice(1);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: db ? Number(db) : undefined,
  };
}
