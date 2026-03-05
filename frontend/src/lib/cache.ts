// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new Map<string, { data: any; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchWithCache(url: string): Promise<any> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return cached.data;
  }
  const res = await fetch(url);
  const data = await res.json();
  cache.set(url, { data, timestamp: Date.now() });
  return data;
}
