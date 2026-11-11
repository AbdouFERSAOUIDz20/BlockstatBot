// Tiny TTL cache with in-flight request de-duplication.
export class Cache {
  constructor() {
    this.store = new Map();
    this.inflight = new Map();
  }

  get(key) {
    const hit = this.store.get(key);
    if (!hit) return undefined;
    if (hit.expires < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key, value, ttlMs) {
    this.store.set(key, { value, expires: Date.now() + ttlMs });
  }

  // Returns cached value or runs `loader` once even if called concurrently.
  async wrap(key, ttlMs, loader) {
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    if (this.inflight.has(key)) return this.inflight.get(key);
    const p = (async () => {
      try {
        const value = await loader();
        this.set(key, value, ttlMs);
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();
    this.inflight.set(key, p);
    return p;
  }

  sweep() {
    const now = Date.now();
    for (const [k, v] of this.store) if (v.expires < now) this.store.delete(k);
  }
}
