import type { CacheInstance } from "@shopify/hydrogen";

import { getRuntime } from "../runtime.ts";

interface CacheEntry {
  expiresAt: number;
  value: unknown;
}

interface MemoryStorefrontCacheOptions {
  maxEntries?: number;
  now?: () => number;
}

/** Bounded process-local fallback for Node, which has no Cache API. */
export class MemoryStorefrontCache {
  readonly #entries = new Map<string, CacheEntry>();
  readonly #maxEntries: number;
  readonly #now: () => number;

  constructor({
    maxEntries = 500,
    now = Date.now,
  }: MemoryStorefrontCacheOptions = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) {
      throw new TypeError("maxEntries must be a positive integer.");
    }
    this.#maxEntries = maxEntries;
    this.#now = now;
  }

  get(key: string): unknown {
    let entry = this.#entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.#now()) {
      this.#entries.delete(key);
      return undefined;
    }

    this.#entries.delete(key);
    this.#entries.set(key, entry);
    return structuredClone(entry.value);
  }

  set(key: string, value: unknown, options?: { ttl?: number }): void {
    let ttl = options?.ttl ?? 0;
    if (!Number.isFinite(ttl) || ttl <= 0) {
      this.#entries.delete(key);
      return;
    }

    this.#pruneExpired();
    this.#entries.delete(key);
    this.#entries.set(key, {
      expiresAt: this.#now() + ttl * 1_000,
      value: structuredClone(value),
    });

    while (this.#entries.size > this.#maxEntries) {
      let oldestKey = this.#entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.#entries.delete(oldestKey);
    }
  }

  delete(key: string): void {
    this.#entries.delete(key);
  }

  get size(): number {
    this.#pruneExpired();
    return this.#entries.size;
  }

  #pruneExpired() {
    let now = this.#now();
    for (let [key, entry] of this.#entries) {
      if (entry.expiresAt <= now) this.#entries.delete(key);
    }
  }
}

const nodeStorefrontCache = new MemoryStorefrontCache();

export function getStorefrontCache(request: Request): CacheInstance {
  return getRuntime(request).cache ?? nodeStorefrontCache;
}
