interface LocalCacheEntry {
  value: unknown
  expireAt: number
}

declare global {
  var __financeLocalCacheStore: Map<string, LocalCacheEntry> | undefined
  var __financeLocalCachePending: Map<string, Promise<unknown>> | undefined
}

const cacheStore = globalThis.__financeLocalCacheStore || new Map<string, LocalCacheEntry>()
const pendingStore = globalThis.__financeLocalCachePending || new Map<string, Promise<unknown>>()

if (!globalThis.__financeLocalCacheStore) {
  globalThis.__financeLocalCacheStore = cacheStore
}

if (!globalThis.__financeLocalCachePending) {
  globalThis.__financeLocalCachePending = pendingStore
}

export const LOCAL_CACHE_ONE_MINUTE_MS = 60 * 1000

function pruneLocalCache(maxSize = 3000) {
  if (cacheStore.size <= maxSize) return

  const now = Date.now()
  for (const [key, entry] of cacheStore.entries()) {
    if (now >= entry.expireAt) {
      cacheStore.delete(key)
    }
  }

  if (cacheStore.size <= maxSize) return

  const removeCount = cacheStore.size - maxSize
  let removed = 0
  for (const key of cacheStore.keys()) {
    cacheStore.delete(key)
    removed += 1
    if (removed >= removeCount) break
  }
}

export function getLocalCacheValue<T>(key: string): { hit: boolean; value: T | null } {
  const entry = cacheStore.get(key)
  if (!entry) return { hit: false, value: null }

  if (Date.now() >= entry.expireAt) {
    cacheStore.delete(key)
    return { hit: false, value: null }
  }

  return { hit: true, value: entry.value as T }
}

export function setLocalCacheValue<T>(key: string, value: T, ttlMs = LOCAL_CACHE_ONE_MINUTE_MS): T {
  cacheStore.set(key, {
    value,
    expireAt: Date.now() + Math.max(1, ttlMs)
  })
  pruneLocalCache()
  return value
}

export async function getOrSetLocalCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = LOCAL_CACHE_ONE_MINUTE_MS
): Promise<T> {
  const cached = getLocalCacheValue<T>(key)
  if (cached.hit) return cached.value as T

  const pending = pendingStore.get(key)
  if (pending) return pending as Promise<T>

  const task = loader()
    .then((value) => setLocalCacheValue(key, value, ttlMs))
    .finally(() => {
      pendingStore.delete(key)
    })

  pendingStore.set(key, task as Promise<unknown>)
  return task
}
