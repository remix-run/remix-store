import { gql, type StorefrontApi } from "@shopify/hydrogen";

import type { MarketCountry } from "../lib/public/market.ts";
import {
  requireStorefrontData,
  STABLE_CACHE,
  StorefrontQueryError,
  type AppStorefrontClient,
} from "./storefront.ts";

const SITEMAP_INDEX_QUERY = gql(`
  query RemixSitemapIndex @inContext(country: US, language: EN) {
    products: sitemap(type: PRODUCT) {
      pagesCount {
        count
      }
    }
    collections: sitemap(type: COLLECTION) {
      pagesCount {
        count
      }
    }
  }
`);

const CANADIAN_SITEMAP_INDEX_QUERY = gql(`
  query RemixCanadianSitemapIndex @inContext(country: CA, language: EN) {
    products: sitemap(type: PRODUCT) {
      pagesCount {
        count
      }
    }
    collections: sitemap(type: COLLECTION) {
      pagesCount {
        count
      }
    }
  }
`);

const SITEMAP_RESOURCES_QUERY = gql(`
  query RemixSitemapResources($type: SitemapType!, $page: Int!)
  @inContext(country: US, language: EN) {
    sitemap(type: $type) {
      resources(page: $page) {
        hasNextPage
        items {
          handle
          updatedAt
          ... on SitemapResource {
            image {
              alt
              filepath
            }
          }
        }
      }
    }
  }
`);

const CANADIAN_SITEMAP_RESOURCES_QUERY = gql(`
  query RemixCanadianSitemapResources($type: SitemapType!, $page: Int!)
  @inContext(country: CA, language: EN) {
    sitemap(type: $type) {
      resources(page: $page) {
        hasNextPage
        items {
          handle
          updatedAt
          ... on SitemapResource {
            image {
              alt
              filepath
            }
          }
        }
      }
    }
  }
`);

export type SitemapResourceType = "collections" | "products";

type SitemapResource = {
  handle: string;
  image?: { alt?: string | null; filepath?: string | null } | null;
  updatedAt: string;
};

export type SitemapPage = {
  hasNextPage: boolean;
  items: SitemapResource[];
};

export async function querySitemapPageCounts(
  storefront: AppStorefrontClient,
  market: MarketCountry = "US",
): Promise<Record<SitemapResourceType, number>> {
  let result =
    market === "CA"
      ? await storefront.graphql(CANADIAN_SITEMAP_INDEX_QUERY, {
          cache: STABLE_CACHE,
        })
      : await storefront.graphql(SITEMAP_INDEX_QUERY, { cache: STABLE_CACHE });
  let message = "The Storefront API did not return sitemap counts.";
  let data = requireStorefrontData(result, message);
  let collectionCount = data.collections.pagesCount?.count;
  let productCount = data.products.pagesCount?.count;
  if (collectionCount === undefined || productCount === undefined) {
    throw new StorefrontQueryError(message);
  }
  return { collections: collectionCount, products: productCount };
}

export async function querySitemapResources(
  storefront: AppStorefrontClient,
  type: SitemapResourceType,
  page: number,
  market: MarketCountry = "US",
): Promise<SitemapPage> {
  let document =
    market === "CA"
      ? CANADIAN_SITEMAP_RESOURCES_QUERY
      : SITEMAP_RESOURCES_QUERY;
  let result = await storefront.graphql(document, {
    cache: STABLE_CACHE,
    variables: { page, type: type === "products" ? "PRODUCT" : "COLLECTION" },
  });
  let message = "The Storefront API did not return sitemap resources.";
  let resources = requireStorefrontData(result, message).sitemap.resources;
  if (!resources) throw new StorefrontQueryError(message);
  return {
    hasNextPage: resources.hasNextPage,
    items: resources.items.map((item) => ({
      handle: item.handle,
      image: "image" in item ? item.image : null,
      updatedAt: item.updatedAt,
    })),
  };
}

/** Response data of this module's Storefront operations, by operation name. */
export interface SitemapOperations {
  RemixSitemapIndex: StorefrontApi.ResultOf<typeof SITEMAP_INDEX_QUERY>;
  RemixCanadianSitemapIndex: StorefrontApi.ResultOf<
    typeof CANADIAN_SITEMAP_INDEX_QUERY
  >;
  RemixSitemapResources: StorefrontApi.ResultOf<typeof SITEMAP_RESOURCES_QUERY>;
  RemixCanadianSitemapResources: StorefrontApi.ResultOf<
    typeof CANADIAN_SITEMAP_RESOURCES_QUERY
  >;
}
