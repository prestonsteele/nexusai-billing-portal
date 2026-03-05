import { createClient } from "redis";

const KV_TTL = 600; // 10 minutes

let client: ReturnType<typeof createClient> | null = null;

async function getClient() {
  const url = process.env.nexus_billing_REDIS_URL;
  if (!url) return null;

  if (!client) {
    client = createClient({ url });
    client.on("error", (err) => console.error("Redis error:", err));
    await client.connect();
  }
  return client;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    const redis = await getClient();
    if (!redis) return null;
    const raw = await redis.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    const redis = await getClient();
    if (!redis) return;
    await redis.set(key, JSON.stringify(value), { EX: KV_TTL });
  } catch {
    // Silently fail — KV is an optimization, not a requirement
  }
}

/** Normalize an ISO timestamp to YYYY-MM-DD so cron keys match user-request keys */
export function toDateKey(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.split("T")[0];
}
