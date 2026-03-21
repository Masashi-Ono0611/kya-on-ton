import { TON_API_BASE_URL, TON_API_KEY, CACHE_TTL_MS } from './constants.js';

const cache = new Map<string, { data: unknown; ts: number }>();

export async function fetchTonApi<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TON_API_BASE_URL}${endpoint}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.append(key, value);
  }

  const cacheKey = url.toString();
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const headers: Record<string, string> = { 'Accept': 'application/json' };
  if (TON_API_KEY) {
    headers['Authorization'] = `Bearer ${TON_API_KEY}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url.toString(), { headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`TonAPI ${response.status}: ${text}`);
    }
    const data = await response.json() as T;
    cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}
