import {
  Cache,
  StorefrontApiError,
  StorefrontTimeoutError,
  type CachingStrategy,
  type GraphQLFormattedError,
  type StorefrontClient,
} from "@shopify/hydrogen";

import {
  isMarketPathPrefix,
  marketForCountry,
  type MarketLocale,
  type MarketPathPrefix,
} from "../lib/public/market.ts";

export type AppStorefrontClient = StorefrontClient<{
  cache?: CachingStrategy;
}>;

/** The Storefront API answered with GraphQL errors or without the requested data. */
export class StorefrontQueryError extends Error {
  override name = "StorefrontQueryError";
}

/**
 * Whether a query failed because of the Storefront API: transport, timeout,
 * or GraphQL errors. Request aborts and programming errors are not, so a
 * caller that degrades to a fallback rethrows anything this rejects.
 */
export function isStorefrontFailure(
  error: unknown,
): error is StorefrontApiError | StorefrontTimeoutError | StorefrontQueryError {
  return (
    error instanceof StorefrontApiError ||
    error instanceof StorefrontTimeoutError ||
    error instanceof StorefrontQueryError
  );
}

/**
 * Runs a Storefront read for content the page can render without. A
 * Storefront failure is logged under `label` and answered with `fallback()`;
 * aborts and programming errors still throw.
 */
export async function withStorefrontFallback<Data>(
  label: string,
  fallback: () => Data,
  read: () => Promise<Data>,
): Promise<Data> {
  try {
    return await read();
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    console.error(`[hydrogen] ${label} failed`, error);
    return fallback();
  }
}

/** Logs GraphQL errors that arrived alongside data the caller still uses. */
export function logPartialStorefrontData(
  label: string,
  errors: readonly GraphQLFormattedError[] | undefined,
): void {
  if (errors?.length) {
    console.error(`[hydrogen] ${label} returned partial data`, errors);
  }
}

/**
 * Returns the response data, or throws a StorefrontQueryError when the API
 * reported errors or returned nothing. Transport failures already throw from
 * `storefront.graphql()`, so every query read either has data or throws.
 */
export function requireStorefrontData<Data>(
  result: { data?: Data | null; errors?: GraphQLFormattedError[] },
  message: string,
): Data {
  if (result.errors || !result.data) {
    throw new StorefrontQueryError(message, { cause: result.errors });
  }
  return result.data;
}

/** Merchant content that changes rarely: menus, editorial, policies, sitemaps. */
export const STABLE_CACHE = Cache.long({ staleIfError: { days: 7 } });

/**
 * Hydrogen 2026.4's default for queries without a strategy, which the React
 * Router storefront used for products and collections: fresh for a second,
 * then served from cache for a day while requests refresh it in the
 * background. Current Hydrogen has no default; its Skeleton example recreates
 * this one for catalog reads.
 */
export const CATALOG_CACHE = Cache.short({
  staleWhileRevalidate: { hours: 23, minutes: 59, seconds: 59 },
  staleIfError: { minutes: 5 },
});

export function storefrontLocale(
  storefront: AppStorefrontClient,
): MarketLocale {
  return marketForCountry(storefront.i18n.country).locale;
}

export function storefrontPathPrefix(
  storefront: AppStorefrontClient,
): MarketPathPrefix {
  let pathPrefix = storefront.i18n.pathPrefix;
  if (isMarketPathPrefix(pathPrefix)) return pathPrefix;
  throw new Error("Unsupported market path prefix.");
}
