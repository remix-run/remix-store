import { gql, type StorefrontClient } from "@shopify/hydrogen";

export const SHOP_QUERY = gql(`
  query PlatformSkeletonShop {
    shop {
      name
      description
    }
  }
`);

export async function queryShop(storefront: StorefrontClient) {
  let result = await storefront.graphql(SHOP_QUERY);
  if (result.errors || !result.data) {
    throw new Error("The Storefront API did not return shop data.", {
      cause: result.errors,
    });
  }
  return result.data.shop;
}
