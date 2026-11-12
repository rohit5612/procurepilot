import crypto from 'crypto';

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}

/**
 * Deterministic stringify for cache keys.
 * - Sorts object keys recursively
 * - Drops undefined values
 * - Keeps arrays in order
 */
export function stableStringify(value) {
  if (value === undefined) return undefined;
  if (value === null) return 'null';

  const t = typeof value;
  if (t === 'string') return JSON.stringify(value);
  if (t === 'number' || t === 'boolean') return String(value);

  if (value instanceof Date) return JSON.stringify(value.toISOString());

  if (Array.isArray(value)) {
    const parts = value.map((v) => stableStringify(v)).filter((v) => v !== undefined);
    return `[${parts.join(',')}]`;
  }

  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    const parts = [];
    for (const k of keys) {
      const sv = stableStringify(value[k]);
      if (sv === undefined) continue;
      parts.push(`${JSON.stringify(k)}:${sv}`);
    }
    return `{${parts.join(',')}}`;
  }

  // Fallback for other objects (Buffers, class instances, etc.)
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
}

/**
 * Build a compact Redis key for API caching.
 *
 * Pattern: api:<version>:<namespace>:<hash>
 * Example: api:v1:inventory:items:list:1a2b3c...
 */
export function buildCacheKey(namespace, params = {}, version = 'v1') {
  const raw = stableStringify(params) ?? '';
  const hash = crypto.createHash('sha1').update(raw).digest('hex');
  return `api:${version}:${namespace}:${hash}`;
}

/**
 * Get from cache or compute and set.
 * Returns { value, hit } where hit=true means cache hit.
 */
export async function cacheGetOrSet(redisManager, key, ttlSeconds, fetcher) {
  const cached = await redisManager.get(key);
  if (cached !== null) return { value: cached, hit: true };

  const value = await fetcher();
  // Best-effort caching; never fail the request because cache is down.
  try {
    await redisManager.set(key, value, ttlSeconds);
  } catch (_) {}
  return { value, hit: false };
}

