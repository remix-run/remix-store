import {
  Cache,
  formatMoney,
  getSelectedProductOptions,
  gql,
  StorefrontApiError,
  StorefrontTimeoutError,
  type CachingStrategy,
  type StorefrontApi,
  type StorefrontClient,
} from "@shopify/hydrogen";
import type { SerializableObject } from "remix/ui";

import { getFocalPoint, type FocalPoint } from "../lib/image-utils.ts";

export type AppStorefrontClient = StorefrontClient<{
  cache?: CachingStrategy;
}>;

export type StorefrontQueryResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; errors: unknown };

export type NavigationMenuItemData = SerializableObject & {
  id: string;
  title: string;
  url: string;
};

export type NavigationMenuData = SerializableObject & {
  items: NavigationMenuItemData[];
};

export type StoreWideSaleData = SerializableObject & {
  description: string;
  endDateTime?: string;
  title: string;
};

export type ShellMenusData = SerializableObject & {
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
};

export type ImageData = SerializableObject & {
  altText?: string | null;
  height?: number | null;
  id?: string | null;
  url: string;
  width?: number | null;
};

export type ProductMoney = SerializableObject & {
  amount: string;
  currencyCode: string;
};

export type ProductCardData = SerializableObject & {
  compareAtPrice?: string | null;
  handle: string;
  id: string;
  images: ImageData[];
  isOnSale: boolean;
  price: string;
  title: string;
};

export type ProductPageInfoData = SerializableObject & {
  endCursor?: string | null;
  hasNextPage: boolean;
};

export type CollectionData = SerializableObject & {
  description: string;
  handle: string;
  id: string;
  products: SerializableObject & {
    nodes: ProductCardData[];
    pageInfo: ProductPageInfoData;
  };
  title: string;
};

export type HomeHeroData = SerializableObject & {
  assetImages: ImageData[];
  collectionHandle: string;
};

export type HomeLookbookEntryData = SerializableObject & {
  id: string;
  image: ImageData;
  focalPoint?: (SerializableObject & FocalPoint) | null;
  product?:
    | (SerializableObject & {
        handle: string;
        price: ProductMoney;
        title: string;
      })
    | null;
};

export type HomeData = SerializableObject & {
  hero: HomeHeroData | null;
  lookbookEntries: HomeLookbookEntryData[];
  pageInfo: ProductPageInfoData;
  products: ProductCardData[];
  shop: {
    description?: string | null;
    name: string;
  };
};

export const FALLBACK_NAVIGATION_MENU: NavigationMenuData = {
  items: [
    { id: "fallback-all", title: "All Products", url: "/collections/all" },
    { id: "fallback-apparel", title: "Apparel", url: "/collections/apparel" },
    {
      id: "fallback-home-office",
      title: "Home & Office",
      url: "/collections/home-office",
    },
  ],
};

export const FALLBACK_FOOTER_MENU: NavigationMenuData = {
  items: [
    {
      id: "fallback-refund",
      title: "Refund Policy",
      url: "/policies/refund-policy",
    },
    {
      id: "fallback-privacy",
      title: "Privacy Policy",
      url: "/policies/privacy-policy",
    },
    {
      id: "fallback-shipping",
      title: "Shipping Policy",
      url: "/policies/shipping-policy",
    },
    {
      id: "fallback-terms",
      title: "Terms of Service",
      url: "/policies/terms-of-service",
    },
    {
      id: "fallback-contact",
      title: "Contact Information",
      url: "/policies/contact-information",
    },
  ],
};

export const SHOP_QUERY = gql(`
  query PlatformSkeletonShop {
    shop {
      name
      description
    }
  }
`);

const HOME_QUERY = gql(`
  query RemixHomeEditorial {
    shop {
      name
      description
    }
    hero: metaobject(
      handle: { handle: "remix-3-drop-playground", type: "hero" }
    ) {
      assetImages: field(key: "asset_images") {
        references(first: 100) {
          nodes {
            __typename
            ... on MediaImage {
              id
              image {
                id
                url
                altText
                width
                height
              }
            }
          }
        }
      }
      collection: field(key: "collection") {
        reference {
          __typename
          ... on Collection {
            handle
          }
        }
      }
    }
    lookbook: metaobject(
      handle: { handle: "lookbook-remix-racing", type: "lookbook" }
    ) {
      entries: field(key: "lookbook") {
        references(first: 100) {
          nodes {
            __typename
            ... on Metaobject {
              id
              fields {
                key
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    presentation {
                      asJson(format: IMAGE)
                    }
                    image {
                      id
                      url
                      altText
                      width
                      height
                    }
                  }
                  ... on Product {
                    id
                    handle
                    title
                    priceRange {
                      minVariantPrice {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`);

const NAVIGATION_QUERY = gql(`
  query RemixNavigation {
    menu(handle: "main-menu") {
      items {
        id
        title
        url
      }
    }
    footerMenu: menu(handle: "footer") {
      items {
        id
        title
        url
      }
    }
    shop {
      primaryDomain {
        url
      }
    }
  }
`);

const STORE_WIDE_SALE_QUERY = gql(`
  query RemixStoreWideSale {
    shop {
      storeWideSale: metafield(namespace: "custom", key: "storewide_sale") {
        reference {
          __typename
          ... on Metaobject {
            title: field(key: "title") {
              value
            }
            description: field(key: "description") {
              value
            }
            endDateTime: field(key: "end_date_and_time") {
              value
            }
          }
        }
      }
    }
  }
`);

const PRODUCT_NAVIGATION_QUERY = gql(`
  query RemixProductNavigation {
    menu(handle: "product-sidebar-menu") {
      items {
        id
        title
        url
      }
    }
    shop {
      primaryDomain {
        url
      }
    }
  }
`);

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

const PRODUCT_VARIANT_FRAGMENT = gql(`
  fragment RemixProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    sku
    product {
      handle
      title
    }
    selectedOptions {
      name
      value
    }
    title
  }
`);

const PRODUCT_QUERY = gql(
  `
    query RemixProduct(
      $handle: String!
      $selectedOptions: [SelectedOptionInput!]!
    ) {
      product(handle: $handle) {
        id
        handle
        title
        vendor
        description
        requiresSellingPlan
        category {
          name
        }
        seo {
          title
          description
        }
        customDescription: metafield(namespace: "custom", key: "description") {
          value
        }
        technicalDescription: metafield(
          namespace: "custom"
          key: "technical_description"
        ) {
          value
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        encodedVariantExistence
        encodedVariantAvailability
        options {
          name
          optionValues {
            name
            firstSelectableVariant {
              ...RemixProductVariant
            }
          }
        }
        selectedOrFirstAvailableVariant(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...RemixProductVariant
        }
        adjacentVariants(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...RemixProductVariant
        }
        images(first: 8) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  `,
  [PRODUCT_VARIANT_FRAGMENT],
);

const STABLE_CACHE = Cache.long({ staleIfError: { days: 7 } });
const CATALOG_CACHE = Cache.short({ staleIfError: { minutes: 5 } });

type ShopData = StorefrontApi.ResultOf<typeof SHOP_QUERY>["shop"];
type HomeQueryData = StorefrontApi.ResultOf<typeof HOME_QUERY>;
export type ProductData = NonNullable<
  StorefrontApi.ResultOf<typeof PRODUCT_QUERY>["product"]
>;

export async function queryShop(
  storefront: AppStorefrontClient,
): Promise<StorefrontQueryResult<ShopData>> {
  try {
    let result = await storefront.graphql(SHOP_QUERY, {
      cache: STABLE_CACHE,
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
 * (the Standard Actions bus the cart store mutates through). Returns null on
 * failure so a query outage never blocks the cart — the no-JS form path still
 * works without the scripts.
 */
export async function queryAnalyticsShop(
  storefront: AppStorefrontClient,
  storefrontId: string,
  myshopifyDomain: string,
): Promise<AnalyticsShop | null> {
  try {
    let result = await storefront.graphql(ANALYTICS_SHOP_QUERY, {
      cache: STABLE_CACHE,
    });
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
      myshopifyDomain,
      shopId,
      storefrontId,
    };
  } catch (error) {
    console.error("[hydrogen] Analytics shop query failed", error);
    return null;
  }
}

export async function queryHome(
  storefront: AppStorefrontClient,
): Promise<StorefrontQueryResult<HomeData>> {
  try {
    let [result, catalog] = await Promise.all([
      storefront.graphql(HOME_QUERY, { cache: STABLE_CACHE }),
      queryCollection(storefront, "all"),
    ]);
    if (result.errors || !result.data) {
      return {
        ok: false,
        message: "The Storefront API did not return home data.",
        errors: result.errors,
      };
    }

    return {
      ok: true,
      data: {
        shop: result.data.shop,
        hero: toHomeHeroData(result.data.hero),
        lookbookEntries: toHomeLookbookEntries(result.data.lookbook),
        products: catalog.ok && catalog.data ? catalog.data.products.nodes : [],
        pageInfo:
          catalog.ok && catalog.data
            ? catalog.data.products.pageInfo
            : { hasNextPage: false, endCursor: null },
      },
    };
  } catch (error) {
    if (
      !(error instanceof StorefrontApiError) &&
      !(error instanceof StorefrontTimeoutError)
    ) {
      throw error;
    }
    return {
      ok: false,
      message: "The Storefront API home request failed.",
      errors: error,
    };
  }
}

export async function queryCollection(
  storefront: AppStorefrontClient,
  handle: string,
  pagination: { after?: string; first?: number } = {},
): Promise<StorefrontQueryResult<CollectionData | null>> {
  try {
    let result = await storefront.graphql(COLLECTION_QUERY, {
      variables: {
        after: pagination.after,
        first: pagination.first ?? 15,
        handle,
      },
      cache: CATALOG_CACHE,
    });
    if (result.errors || !result.data) {
      return {
        ok: false,
        message: "The Storefront API did not return collection data.",
        errors: result.errors,
      };
    }

    let collection = result.data.collection;
    if (!collection) return { ok: true, data: null };
    return {
      ok: true,
      data: {
        id: collection.id,
        handle: collection.handle,
        title: collection.title,
        description: collection.description,
        products: {
          nodes: collection.products.nodes.map(toProductCardData),
          pageInfo: collection.products.pageInfo,
        },
      },
    };
  } catch (error) {
    if (
      !(error instanceof StorefrontApiError) &&
      !(error instanceof StorefrontTimeoutError)
    ) {
      throw error;
    }
    return {
      ok: false,
      message: "The Storefront API collection request failed.",
      errors: error,
    };
  }
}

export async function queryProductNavigation(
  storefront: AppStorefrontClient,
  storeDomain: string,
): Promise<NavigationMenuData> {
  try {
    let result = await storefront.graphql(PRODUCT_NAVIGATION_QUERY, {
      cache: STABLE_CACHE,
    });
    if (result.errors) {
      console.error(
        "[hydrogen] Product navigation query returned partial data",
        result.errors,
      );
    }

    let internalHosts = new Set([normalizeStoreDomain(storeDomain)]);
    let primaryDomain = result.data?.shop?.primaryDomain?.url;
    if (primaryDomain) internalHosts.add(new URL(primaryDomain).host);

    return mapNavigationMenu(result.data?.menu, internalHosts, {
      items: [],
    });
  } catch (error) {
    console.error("[hydrogen] Product navigation query failed", error);
    return { items: [] };
  }
}

export async function queryProduct(
  storefront: AppStorefrontClient,
  handle: string,
  searchParams: URLSearchParams,
): Promise<StorefrontQueryResult<ProductData | null>> {
  try {
    let result = await storefront.graphql(PRODUCT_QUERY, {
      variables: {
        handle,
        selectedOptions: getSelectedProductOptions({ searchParams }),
      },
      cache: CATALOG_CACHE,
    });
    if (result.errors || !result.data) {
      return {
        ok: false,
        message: "The Storefront API did not return product data.",
        errors: result.errors,
      };
    }

    return { ok: true, data: result.data.product };
  } catch (error) {
    if (
      !(error instanceof StorefrontApiError) &&
      !(error instanceof StorefrontTimeoutError)
    ) {
      throw error;
    }
    return {
      ok: false,
      message: "The Storefront API product request failed.",
      errors: error,
    };
  }
}

export async function queryShellMenus(
  storefront: AppStorefrontClient,
  storeDomain: string,
): Promise<ShellMenusData> {
  let [menus, storeWideSale] = await Promise.all([
    queryLongLivedShellMenus(storefront, storeDomain),
    queryActiveStoreWideSale(storefront),
  ]);

  return { ...menus, storeWideSale };
}

async function queryLongLivedShellMenus(
  storefront: AppStorefrontClient,
  storeDomain: string,
): Promise<{
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
}> {
  try {
    let result = await storefront.graphql(NAVIGATION_QUERY, {
      cache: STABLE_CACHE,
    });
    if (result.errors) {
      console.error(
        "[hydrogen] Navigation query returned partial data",
        result.errors,
      );
    }

    let internalHosts = new Set([normalizeStoreDomain(storeDomain)]);
    let primaryDomain = result.data?.shop?.primaryDomain?.url;
    if (primaryDomain) internalHosts.add(new URL(primaryDomain).host);

    return {
      navigationMenu: mapNavigationMenu(
        result.data?.menu,
        internalHosts,
        FALLBACK_NAVIGATION_MENU,
      ),
      footerMenu: mapFooterMenu(
        result.data?.footerMenu,
        internalHosts,
        FALLBACK_FOOTER_MENU,
      ),
    };
  } catch (error) {
    console.error("[hydrogen] Navigation query failed", error);
    return {
      navigationMenu: FALLBACK_NAVIGATION_MENU,
      footerMenu: FALLBACK_FOOTER_MENU,
    };
  }
}

async function queryActiveStoreWideSale(
  storefront: AppStorefrontClient,
): Promise<StoreWideSaleData | null> {
  try {
    let result = await storefront.graphql(STORE_WIDE_SALE_QUERY, {
      cache: CATALOG_CACHE,
    });
    if (result.errors) {
      console.error(
        "[hydrogen] Store-wide sale query returned partial data",
        result.errors,
      );
      return null;
    }

    // Always validate after the cache lookup so stale sale metadata disappears
    // immediately after its merchant-configured expiration.
    return toActiveStoreWideSale(result.data?.shop?.storeWideSale?.reference);
  } catch (error) {
    console.error("[hydrogen] Store-wide sale query failed", error);
    return null;
  }
}

/**
 * Accepts only complete merchant copy and a valid, future expiration. An
 * omitted expiration intentionally represents an open-ended sale; a present
 * but malformed value hides the promotion rather than publishing stale copy.
 */
export function toActiveStoreWideSale(
  reference:
    | {
        __typename?: string;
        description?: { value?: string | null } | null;
        endDateTime?: { value?: string | null } | null;
        title?: { value?: string | null } | null;
      }
    | null
    | undefined,
  now = Date.now(),
): StoreWideSaleData | null {
  if (!reference || reference.__typename !== "Metaobject") return null;

  let title = reference.title?.value?.trim();
  let description = reference.description?.value?.trim();
  if (!title || !description) return null;

  let endDateTime = reference.endDateTime?.value;
  if (endDateTime !== null && endDateTime !== undefined) {
    endDateTime = endDateTime.trim();
    if (!endDateTime || !isIsoDateTime(endDateTime)) return null;
    let expiresAt = Date.parse(endDateTime);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  }

  return endDateTime
    ? { title, description, endDateTime }
    : { title, description };
}

function isIsoDateTime(value: string): boolean {
  let match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(
      value,
    );
  if (!match) return false;

  let [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] =
    match;
  let year = Number(yearValue);
  let month = Number(monthValue);
  let day = Number(dayValue);
  let hour = Number(hourValue);
  let minute = Number(minuteValue);
  let second = Number(secondValue ?? "0");
  let offsetHour = Number(match[7] ?? "0");
  let offsetMinute = Number(match[8] ?? "0");
  let daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= daysInMonth &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59
  );
}

function mapNavigationMenu(
  menu:
    | {
        items: ReadonlyArray<{
          id: string;
          title: string;
          url?: string | null;
        }>;
      }
    | null
    | undefined,
  internalHosts: Set<string>,
  fallback: NavigationMenuData,
): NavigationMenuData {
  if (!menu) return fallback;

  return {
    items: menu.items.flatMap((item) =>
      item.url
        ? [
            {
              id: item.id,
              title: item.title,
              url: normalizeMenuUrl(item.url, internalHosts),
            },
          ]
        : [],
    ),
  };
}

function mapFooterMenu(
  menu: Parameters<typeof mapNavigationMenu>[0],
  internalHosts: Set<string>,
  fallback: NavigationMenuData,
): NavigationMenuData {
  if (!menu) return fallback;

  let policyPaths = new Map(
    FALLBACK_FOOTER_MENU.items.map((item) => [
      item.title.toLowerCase(),
      item.url,
    ]),
  );
  return {
    items: menu.items.flatMap((item) => {
      if (!item.url) return [];
      let normalizedUrl = normalizeMenuUrl(item.url, internalHosts);
      let policyPath = policyPaths.get(item.title.toLowerCase());
      return [
        {
          id: item.id,
          title: item.title,
          url:
            policyPath && isInternalUrl(item.url, internalHosts)
              ? policyPath
              : normalizedUrl,
        },
      ];
    }),
  };
}

function normalizeMenuUrl(value: string, internalHosts: Set<string>): string {
  if (value.startsWith("/")) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "/";
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return "/";
  return internalHosts.has(url.host)
    ? `${url.pathname}${url.search}${url.hash}`
    : url.href;
}

function isInternalUrl(value: string, internalHosts: Set<string>): boolean {
  if (value.startsWith("/")) return true;
  try {
    return internalHosts.has(new URL(value).host);
  } catch {
    return false;
  }
}

function toHomeHeroData(hero: HomeQueryData["hero"]): HomeHeroData | null {
  if (!hero) return null;

  let assetImages =
    hero.assetImages?.references?.nodes.flatMap((node) => {
      if (node.__typename !== "MediaImage" || !node.image) return [];
      return [
        {
          id: node.image.id,
          url: homeHeroImageUrl(node.image.url),
          altText: node.image.altText,
          width: node.image.width,
          height: node.image.height,
        },
      ];
    }) ?? [];
  let collectionReference = hero.collection?.reference;
  let collectionHandle =
    collectionReference?.__typename === "Collection"
      ? collectionReference.handle
      : "all";

  return { assetImages, collectionHandle };
}

function toHomeLookbookEntries(
  lookbook: HomeQueryData["lookbook"],
): HomeLookbookEntryData[] {
  return (
    lookbook?.entries?.references?.nodes.flatMap((entry, index) => {
      if (entry.__typename !== "Metaobject") return [];

      let imageReference = entry.fields.find(
        (field) => field.reference?.__typename === "MediaImage",
      )?.reference;
      if (
        imageReference?.__typename !== "MediaImage" ||
        !imageReference.image
      ) {
        return [];
      }

      let productReference = entry.fields.find(
        (field) => field.reference?.__typename === "Product",
      )?.reference;
      let product =
        productReference?.__typename === "Product"
          ? {
              handle: productReference.handle,
              price: {
                amount: productReference.priceRange.minVariantPrice.amount,
                currencyCode:
                  productReference.priceRange.minVariantPrice.currencyCode,
              },
              title: productReference.title,
            }
          : null;

      return [
        {
          id: entry.id ?? imageReference.image.id ?? `lookbook-${index}`,
          image: {
            id: imageReference.image.id,
            url: imageReference.image.url,
            altText: imageReference.image.altText,
            width: imageReference.image.width,
            height: imageReference.image.height,
          },
          focalPoint: toSerializableFocalPoint(
            getFocalPoint(imageReference.presentation?.asJson),
          ),
          product,
        },
      ];
    }) ?? []
  );
}

function toProductCardData(product: {
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
}): ProductCardData {
  let price =
    product.selectedOrFirstAvailableVariant?.price ??
    product.priceRange.maxVariantPrice;
  let compareAtPrice =
    product.selectedOrFirstAvailableVariant?.compareAtPrice ?? null;
  let formattedPrice = formatMoney(price, { locale: "en-US" });
  let formattedCompareAtPrice = compareAtPrice
    ? formatMoney(compareAtPrice, { locale: "en-US" })
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

function toSerializableFocalPoint(
  point: FocalPoint | undefined,
): (SerializableObject & FocalPoint) | null {
  return point ? { x: point.x, y: point.y } : null;
}

function homeHeroImageUrl(source: string): string {
  try {
    let url = new URL(source);
    url.searchParams.set("width", "1600");
    url.searchParams.set("height", "900");
    url.searchParams.set("crop", "center");
    return url.toString();
  } catch {
    return source;
  }
}

export function normalizeStoreDomain(value: string): string {
  return new URL(value.includes("://") ? value : `https://${value}`).host;
}
