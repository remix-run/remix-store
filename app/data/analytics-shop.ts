import { gql, type StorefrontApi } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

import {
  requireStorefrontData,
  STABLE_CACHE,
  withStorefrontFallback,
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
  return withStorefrontFallback(
    "Analytics shop query",
    () => null,
    async () => {
      let data = requireStorefrontData(
        await storefront.graphql(ANALYTICS_SHOP_QUERY, { cache: STABLE_CACHE }),
        "The Storefront API did not return analytics shop data.",
      );
      let shopId = data.shop?.id;
      let currency = data.localization?.country?.currency.isoCode;
      if (!shopId || !currency) return null;
      return {
        channel: "hydrogen",
        currency,
        myshopifyDomain: new URL(storefront.storeUrl).host,
        shopId,
        storefrontId: storefront.storefrontId ?? "0",
      };
    },
  );
}

/** Response data of this module's Storefront operations, by operation name. */
export interface AnalyticsShopOperations {
  RemixAnalyticsShop: StorefrontApi.ResultOf<typeof ANALYTICS_SHOP_QUERY>;
}
