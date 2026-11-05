import { formatMoney, gql } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

import type { MarketLocale } from "../lib/public/market.ts";
import type {
  ProductCardData,
  ProductMoney,
  ProductPageInfoData,
} from "./public/types.ts";
import {
  CATALOG_CACHE,
  requireStorefrontData,
  storefrontLocale,
  type AppStorefrontClient,
} from "./storefront.ts";

export type CollectionData = SerializableObject & {
  description: string;
  handle: string;
  id: string;
  products: SerializableObject & {
    nodes: ProductCardData[];
    pageInfo: ProductPageInfoData;
  };
  seoTitle: string | null;
  title: string;
};

const PRODUCT_CARD_FRAGMENT = gql(`
  fragment RemixProductCard on Product {
    id
    handle
    title
    images(first: 2) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    selectedOrFirstAvailableVariant {
      price {
        amount
        currencyCode
      }
      compareAtPrice {
        amount
        currencyCode
      }
    }
    priceRange {
      maxVariantPrice {
        amount
        currencyCode
      }
    }
  }
`);

const COLLECTION_QUERY = gql(
  `
    query RemixCollection(
      $handle: String!
      $first: Int!
      $after: String
      $country: CountryCode
      $language: LanguageCode
    ) @inContext(country: $country, language: $language) {
      collection(handle: $handle) {
        id
        handle
        title
        description
        seo {
          title
        }
        products(first: $first, after: $after) {
          nodes {
            ...RemixProductCard
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  `,
  [PRODUCT_CARD_FRAGMENT],
);

/** Returns null for an unknown handle; throws when the Storefront API fails. */
export async function queryCollection(
  storefront: AppStorefrontClient,
  handle: string,
  pagination: { after?: string; first?: number } = {},
): Promise<CollectionData | null> {
  let result = await storefront.graphql(COLLECTION_QUERY, {
    variables: {
      after: pagination.after,
      first: pagination.first ?? 15,
      handle,
    },
    cache: CATALOG_CACHE,
  });
  let { collection } = requireStorefrontData(
    result,
    "The Storefront API did not return collection data.",
  );
  if (!collection) return null;

  let locale = storefrontLocale(storefront);
  return {
    id: collection.id,
    handle: collection.handle,
    title: collection.title,
    description: collection.description,
    seoTitle: collection.seo.title ?? null,
    products: {
      nodes: collection.products.nodes.map((product) =>
        toProductCardData(product, locale),
      ),
      pageInfo: collection.products.pageInfo,
    },
  };
}

function toProductCardData(
  product: {
    handle: string;
    id: string;
    images: {
      nodes: Array<{
        altText?: string | null;
        height?: number | null;
        id?: string | null;
        url: string;
        width?: number | null;
      }>;
    };
    priceRange: {
      maxVariantPrice: ProductMoney;
    };
    selectedOrFirstAvailableVariant?: {
      compareAtPrice?: ProductMoney | null;
      price: ProductMoney;
    } | null;
    title: string;
  },
  locale: MarketLocale,
): ProductCardData {
  let price =
    product.selectedOrFirstAvailableVariant?.price ??
    product.priceRange.maxVariantPrice;
  let compareAtPrice =
    product.selectedOrFirstAvailableVariant?.compareAtPrice ?? null;
  let formattedPrice = formatMoney(price, { locale });
  let formattedCompareAtPrice = compareAtPrice
    ? formatMoney(compareAtPrice, { locale })
    : null;

  return {
    id: product.id,
    handle: product.handle,
    title: product.title,
    images: product.images.nodes.map((image) => ({
      id: image.id,
      url: image.url,
      altText: image.altText,
      width: image.width,
      height: image.height,
    })),
    price: formattedPrice.toString(),
    compareAtPrice: formattedCompareAtPrice?.toString() ?? null,
    isOnSale:
      formattedCompareAtPrice !== null &&
      formattedPrice.numericAmount < formattedCompareAtPrice.numericAmount,
  };
}
