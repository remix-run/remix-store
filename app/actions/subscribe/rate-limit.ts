const MS_PER_SECOND = 1000;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

/**
 * One atomic reservation across every supplied key.
 *
 * Shared production implementations must commit all keys or none of them in a
 * single storage transaction. The promise-based contract permits networked
 * adapters without changing the controller.
 */
export interface RateLimiter {
  consumeMany(keys: readonly string[]): Promise<RateLimitResult>;
}

export interface FixedWindowRateLimiterOptions {
  limit: number;
  maxEntries: number;
  now?: () => number;
  windowMs: number;
}

type Entry = { count: number; resetAt: number };

/**
 * Bounded, process-local fixed-window limiter, atomic only within this
 * isolate. See docs/admin-api.md for the shared edge quota production needs.
 */
export class FixedWindowRateLimiter implements RateLimiter {
  readonly #entries = new Map<string, Entry>();
  readonly #limit: number;
  readonly #maxEntries: number;
  readonly #now: () => number;
  readonly #windowMs: number;

  constructor(options: FixedWindowRateLimiterOptions) {
    if (
      !Number.isInteger(options.limit) ||
      options.limit < 1 ||
      !Number.isInteger(options.maxEntries) ||
      options.maxEntries < 1 ||
      !Number.isFinite(options.windowMs) ||
      options.windowMs < 1
    ) {
      throw new TypeError("Rate limiter options must be positive numbers.");
    }
    this.#limit = options.limit;
    this.#maxEntries = options.maxEntries;
    this.#now = options.now ?? Date.now;
    this.#windowMs = options.windowMs;
  }

  async consumeMany(keys: readonly string[]): Promise<RateLimitResult> {
    let uniqueKeys = [...new Set(keys)];
    if (
      uniqueKeys.length === 0 ||
      uniqueKeys.length > this.#maxEntries ||
      uniqueKeys.some((key) => !key)
    ) {
      throw new TypeError(
        "Rate limit keys must be non-empty and fit capacity.",
      );
    }

    let now = this.#now();
    this.#prune(now);

    let retryAfterSeconds = 0;
    for (let key of uniqueKeys) {
      let entry = this.#entries.get(key);
      if (entry && entry.count >= this.#limit) {
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.max(1, Math.ceil((entry.resetAt - now) / MS_PER_SECOND)),
        );
      }
    }
    if (retryAfterSeconds) return { allowed: false, retryAfterSeconds };

    let newKeyCount = uniqueKeys.filter(
      (key) => !this.#entries.has(key),
    ).length;
    this.#makeRoom(newKeyCount, new Set(uniqueKeys));

    for (let key of uniqueKeys) {
      let entry = this.#entries.get(key);
      if (entry) {
        entry.count += 1;
        // Refresh insertion order so bounded eviction approximates LRU.
        this.#entries.delete(key);
        this.#entries.set(key, entry);
      } else {
        this.#entries.set(key, {
          count: 1,
          resetAt: now + this.#windowMs,
        });
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  #prune(now: number) {
    for (let [key, entry] of this.#entries) {
      if (entry.resetAt <= now) this.#entries.delete(key);
    }
  }

  #makeRoom(newKeyCount: number, protectedKeys: ReadonlySet<string>) {
    if (this.#entries.size + newKeyCount <= this.#maxEntries) return;
    for (let key of this.#entries.keys()) {
      if (protectedKeys.has(key)) continue;
      this.#entries.delete(key);
      if (this.#entries.size + newKeyCount <= this.#maxEntries) return;
    }
  }
}

export const subscriptionRateLimiter = new FixedWindowRateLimiter({
  limit: 5,
  maxEntries: 10_000,
  windowMs: 10 * 60 * MS_PER_SECOND,
});
