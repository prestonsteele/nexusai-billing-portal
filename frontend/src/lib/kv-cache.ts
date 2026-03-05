import { kv } from "@vercel/kv";

const KV_TTL = 600; // 10 minutes — matches ORB_CACHE_STABLE, longer than client-side 5min cache

export async function kvGet<T>(key: string): Promise<T | null> {
  try {
    return await kv.get<T>(key);
  } catch {
    // KV not configured (e.g. local dev without .env.local KV vars) — fall through to Orb
    return null;
  }
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  try {
    await kv.set(key, value, { ex: KV_TTL });
  } catch {
    // Silently fail — KV is an optimization, not a requirement
  }
}

/** Normalize an ISO timestamp to YYYY-MM-DD so cron keys match user-request keys */
export function toDateKey(isoString: string | null | undefined): string {
  if (!isoString) return "";
  return isoString.split("T")[0];
}
