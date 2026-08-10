import {
  Cache,
  gql,
  StorefrontApiError,
  StorefrontTimeoutError,
  type CachingStrategy,
  type StorefrontApi,
  type StorefrontClient,
} from "@shopify/hydrogen";

export type AppStorefrontClient = StorefrontClient<{
  cache?: CachingStrategy;
}>;

export type StorefrontQueryResult<T> =
  { ok: true; data: T } | { ok: false; message: string; errors: unknown };

export const SHOP_QUERY = gql(`
  query PlatformSkeletonShop {
    shop {
      name
      description
    }
  }
`);

type ShopData = StorefrontApi.ResultOf<typeof SHOP_QUERY>["shop"];

export async function queryShop(
  storefront: AppStorefrontClient,
): Promise<StorefrontQueryResult<ShopData>> {
  try {
    let result = await storefront.graphql(SHOP_QUERY, {
      cache: Cache.long(),
    });
    if (result.errors || !result.data) {
      return {
        ok: false,
        message: "The Storefront API did not return shop data.",
        errors: result.errors,
      };
    }
    return { ok: true, data: result.data.shop };
  } catch (error) {
    if (
      !(error instanceof StorefrontApiError) &&
      !(error instanceof StorefrontTimeoutError)
    ) {
      throw error;
    }
    return {
      ok: false,
      message: "The Storefront API request failed.",
      errors: error,
    };
  }
}
