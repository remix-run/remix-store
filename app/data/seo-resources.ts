import {
  Cache,
  gql,
  StorefrontApiError,
  StorefrontTimeoutError,
} from "@shopify/hydrogen";

import type { AppStorefrontClient } from "./storefront.ts";

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

const SITEMAP_CACHE = Cache.long({ staleIfError: { days: 7 } });

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
  market: "US" | "CA" = "US",
): Promise<Record<SitemapResourceType, number>> {
  try {
    let result =
      market === "CA"
        ? await storefront.graphql(CANADIAN_SITEMAP_INDEX_QUERY, {
            cache: SITEMAP_CACHE,
          })
        : await storefront.graphql(SITEMAP_INDEX_QUERY, {
            cache: SITEMAP_CACHE,
          });
    let collectionCount = result.data?.collections.pagesCount?.count;
    let productCount = result.data?.products.pagesCount?.count;
    if (
      result.errors ||
      collectionCount === undefined ||
      productCount === undefined
    ) {
      throw new Error("The Storefront API did not return sitemap counts.", {
        cause: result.errors,
      });
    }
    return {
      collections: collectionCount,
      products: productCount,
    };
  } catch (error) {
    throw error instanceof Error
      ? sitemapError(error)
      : new Error("Sitemap request failed.");
  }
}

export async function querySitemapResources(
  storefront: AppStorefrontClient,
  type: SitemapResourceType,
  page: number,
  market: "US" | "CA" = "US",
): Promise<SitemapPage> {
  try {
    let document =
      market === "CA"
        ? CANADIAN_SITEMAP_RESOURCES_QUERY
        : SITEMAP_RESOURCES_QUERY;
    let result = await storefront.graphql(document, {
      cache: SITEMAP_CACHE,
      variables: { page, type: type === "products" ? "PRODUCT" : "COLLECTION" },
    });
    let resources = result.data?.sitemap.resources;
    if (result.errors || !resources) {
      throw new Error("The Storefront API did not return sitemap resources.", {
        cause: result.errors,
      });
    }
    return {
      hasNextPage: resources.hasNextPage,
      items: resources.items.map((item) => ({
        handle: item.handle,
        image: "image" in item ? item.image : null,
        updatedAt: item.updatedAt,
      })),
    };
  } catch (error) {
    throw error instanceof Error
      ? sitemapError(error)
      : new Error("Sitemap request failed.");
  }
}

function sitemapError(error: Error): Error {
  if (
    error instanceof StorefrontApiError ||
    error instanceof StorefrontTimeoutError
  ) {
    return new Error("The Storefront API sitemap request failed.", {
      cause: error,
    });
  }
  return error;
}
