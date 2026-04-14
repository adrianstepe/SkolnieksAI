import { createClient } from "redis";

// Singleton client reused across invocations in the same serverless container.
// eslint-disable-next-line no-var
declare global { var _redisRlClient: ReturnType<typeof createClient> | undefined }

async function getClient(): Promise<ReturnType<typeof createClient> | null> {
  if (!process.env.REDIS_URL) return null;

  if (!globalThis._redisRlClient) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (err) =>
      console.error("[ratelimit] Redis client error:", err)
    );
    await client.connect();
    globalThis._redisRlClient = client;
  }

  return globalThis._redisRlClient;
}

/**
 * Fixed-window counter: at most `limit` requests per `windowSecs` window.
 *
 * Uses INCR + EXPIRE — two round-trips but acceptable for burst protection.
 * Fails open on any Redis error so a Redis outage never blocks legitimate users.
 * Firestore daily caps remain as the authoritative backstop in all cases.
 */
export async function checkRateLimit(
  identifier: string,
  limit: number,
  windowSecs: number
): Promise<{ allowed: boolean; retryAfter: number }> {
  try {
    const client = await getClient();
    if (client === null) {
      // REDIS_URL not configured — fail open, warn once per cold start
      console.warn(
        "[ratelimit] REDIS_URL not set — rate limiting disabled. " +
          "Add REDIS_URL to Vercel environment variables to enable burst protection."
      );
      return { allowed: true, retryAfter: 0 };
    }

    // Bucket key resets with each new time window
    const bucket = Math.floor(Date.now() / (windowSecs * 1000));
    const key = `rl:chat:${identifier}:${bucket}`;

    const count = await client.incr(key);
    if (count === 1) {
      // First request in this bucket — set TTL so Redis auto-cleans the key
      await client.expire(key, windowSecs * 2);
    }

    if (count > limit) {
      return { allowed: false, retryAfter: windowSecs };
    }
    return { allowed: true, retryAfter: 0 };
  } catch (err) {
    console.error("[ratelimit] Redis error — fail-open:", err);
    return { allowed: true, retryAfter: 0 };
  }
}
