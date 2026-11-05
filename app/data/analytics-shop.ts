import { gql, type StorefrontApi } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

import {
  isStorefrontFailure,
  STABLE_CACHE,
  type AppStorefrontClient,
} from "./storefront.ts";

export type AnalyticsShop = SerializableObject & {
  channel: "hydrogen";
  currency: string;
  myshopifyDomain: string;
  shopId: string;
  storefrontId: string;
};

const ANALYTICS_SHOP_QUERY = gql(`
  query RemixAnalyticsShop($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
    shop {
      id
    }
    localization {
      country {
        currency {
          isoCode
        }
      }
    }
  }
`);

/**
 * Fetches the shop ID and currency required to render Shopify script tags
 * (the Standard Actions bus the cart store mutates through). Returns null
 * during a Storefront outage so it never blocks the cart — the no-JS form
 * path still works without the scripts.
 */
export async function loadAnalyticsShopOrNull(
  storefront: AppStorefrontClient,
): Promise<AnalyticsShop | null> {
  let result;
  try {
    result = await storefront.graphql(ANALYTICS_SHOP_QUERY, {
      cache: STABLE_CACHE,
    });
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    console.error("[hydrogen] Analytics shop query failed", error);
    return null;
  }

  let shopId = result.data?.shop?.id;
  let currency = result.data?.localization?.country?.currency.isoCode;
  if (result.errors || !shopId || !currency) {
    if (result.errors) {
      console.error("[hydrogen] Analytics shop query failed", result.errors);
    }
    return null;
  }
  return {
    channel: "hydrogen",
    currency,
    myshopifyDomain: new URL(storefront.storeUrl).host,
    shopId,
    storefrontId: storefront.storefrontId ?? "0",
  };
}

/** Response data of this module's Storefront operations, by operation name. */
export interface AnalyticsShopOperations {
  RemixAnalyticsShop: StorefrontApi.ResultOf<typeof ANALYTICS_SHOP_QUERY>;
}
