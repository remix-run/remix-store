import type { CacheControlInit } from "remix/headers/cache-control";

/**
 * Shared `Cache-Control` policies. Assign them through `SuperHeaders`, e.g.
 * `new SuperHeaders({ cacheControl: cacheControl.browsing })`.
 */
export const cacheControl = {
  /** Health checks, failures, and stale asset fingerprints. */
  noStore: { noStore: true },
  /** Personalized documents, cart pages, mutations, and errors. */
  privateNoStore: { private: true, noStore: true },
  /**
   * Frame responses for catalog browsing. Long enough for an intent prefetch
   * to be reused by the navigation that follows; never in shared caches.
   */
  browsing: { private: true, maxAge: 5 },
  /** Unfingerprinted public files and SEO documents. */
  publicDay: { public: true, maxAge: 86_400 },
} as const satisfies Record<string, CacheControlInit>;
