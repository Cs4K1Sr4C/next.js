export interface RedisConnectionOptions {
  host: string;
  port: number;
  username?: string;
  password?: string;
  db?: number;
  tls?: { servername: string };
}

/**
 * Turns `REDIS_URL` into the `{ host, port, ... }` shape accepted by both the
 * Nest Redis transport and BullMQ. Use `rediss://` for TLS, which managed
 * Redis services usually require.
 */
export function redisConnectionOptions(
  url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
): RedisConnectionOptions {
  const parsed = new URL(url);
  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(
      `REDIS_URL must start with redis:// or rediss://, got ${parsed.protocol}//`,
    );
  }
  const db = parsed.pathname.slice(1);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: db ? Number(db) : undefined,
    // Without this, a rediss:// URL would silently connect in plaintext and
    // send the password unencrypted.
    tls:
      parsed.protocol === "rediss:"
        ? { servername: parsed.hostname }
        : undefined,
  };
}
