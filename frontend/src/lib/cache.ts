const cache = new Map<string, { data: unknown; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export async function fetchWithCache<T>(url: string): Promise<T> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.data as T;
  }
  const res = await fetch(url);
  const data = await res.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
