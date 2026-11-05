import { gql, type StorefrontApi } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

import {
  localizeInternalUrl,
  type MarketPathPrefix,
} from "../lib/public/market.ts";
import type { NavigationMenuData, StoreWideSaleData } from "./public/types.ts";
import {
  isStorefrontFailure,
  STABLE_CACHE,
  storefrontPathPrefix,
  type AppStorefrontClient,
} from "./storefront.ts";

export type ShellMenusData = SerializableObject & {
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
  storeWideSale: StoreWideSaleData | null;
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

const NAVIGATION_QUERY = gql(`
  query RemixNavigation($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
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
  query RemixProductNavigation(
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
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

type MenuQueryData = {
  items: ReadonlyArray<{ id: string; title: string; url?: string | null }>;
};

/**
 * Loads the header and footer menus and the store-wide sale banner. A
 * Storefront outage falls back to the built-in menus so every page still
 * renders its shell; partial GraphQL errors keep whatever data arrived.
 */
export async function loadShellMenusOrFallback(
  storefront: AppStorefrontClient,
): Promise<ShellMenusData> {
  let pathPrefix = storefrontPathPrefix(storefront);
  let result;
  try {
    result = await storefront.graphql(NAVIGATION_QUERY, {
      cache: STABLE_CACHE,
    });
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    console.error("[hydrogen] Navigation query failed", error);
    return {
      navigationMenu: localizeNavigationMenu(
        FALLBACK_NAVIGATION_MENU,
        pathPrefix,
      ),
      footerMenu: localizeNavigationMenu(FALLBACK_FOOTER_MENU, pathPrefix),
      storeWideSale: null,
    };
  }
  if (result.errors) {
    console.error(
      "[hydrogen] Navigation query returned partial data",
      result.errors,
    );
  }

  let internalHosts = storeHosts(
    storefront,
    result.data?.shop?.primaryDomain?.url,
  );
  return {
    navigationMenu: mapNavigationMenu(
      result.data?.menu,
      internalHosts,
      FALLBACK_NAVIGATION_MENU,
      pathPrefix,
    ),
    footerMenu: mapFooterMenu(
      result.data?.footerMenu,
      internalHosts,
      pathPrefix,
    ),
    // Recheck expiration after the cache lookup so a stale cached sale
    // disappears as soon as its merchant-configured end time passes.
    storeWideSale: toActiveStoreWideSale(
      result.data?.shop?.storeWideSale?.reference,
    ),
  };
}

/** Loads the product page sidebar menu, or an empty menu during an outage. */
export async function loadProductNavigationOrEmpty(
  storefront: AppStorefrontClient,
): Promise<NavigationMenuData> {
  let result;
  try {
    result = await storefront.graphql(PRODUCT_NAVIGATION_QUERY, {
      cache: STABLE_CACHE,
    });
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    console.error("[hydrogen] Product navigation query failed", error);
    return { items: [] };
  }
  if (result.errors) {
    console.error(
      "[hydrogen] Product navigation query returned partial data",
      result.errors,
    );
  }

  return mapNavigationMenu(
    result.data?.menu,
    storeHosts(storefront, result.data?.shop?.primaryDomain?.url),
    { items: [] },
    storefrontPathPrefix(storefront),
  );
}

/**
 * Accepts only complete merchant copy and a valid, future expiration. An
 * omitted expiration is an open-ended sale; a present but unparsable value
 * hides the promotion rather than publishing stale copy.
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

  let endDateTime = reference.endDateTime?.value?.trim();
  if (endDateTime) {
    let expiresAt = Date.parse(endDateTime);
    if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
    return { title, description, endDateTime };
  }

  return { title, description };
}

export function localizeNavigationMenu(
  menu: NavigationMenuData,
  pathPrefix: MarketPathPrefix,
): NavigationMenuData {
  if (!pathPrefix) return menu;
  return {
    items: menu.items.map((item) => ({
      ...item,
      url: localizeInternalUrl(item.url, pathPrefix),
    })),
  };
}

/** Hosts whose menu links are rewritten to app-relative paths. */
function storeHosts(
  storefront: AppStorefrontClient,
  primaryDomainUrl: string | undefined,
): Set<string> {
  let hosts = new Set([new URL(storefront.storeUrl).host]);
  if (primaryDomainUrl) hosts.add(new URL(primaryDomainUrl).host);
  return hosts;
}

function mapNavigationMenu(
  menu: MenuQueryData | null | undefined,
  internalHosts: Set<string>,
  fallback: NavigationMenuData,
  pathPrefix: MarketPathPrefix,
): NavigationMenuData {
  if (!menu) return localizeNavigationMenu(fallback, pathPrefix);

  return {
    items: menu.items.flatMap((item) =>
      item.url
        ? [
            {
              id: item.id,
              title: item.title,
              url: localizeInternalUrl(
                normalizeMenuUrl(item.url, internalHosts),
                pathPrefix,
              ),
            },
          ]
        : [],
    ),
  };
}

function mapFooterMenu(
  menu: MenuQueryData | null | undefined,
  internalHosts: Set<string>,
  pathPrefix: MarketPathPrefix,
): NavigationMenuData {
  if (!menu) return localizeNavigationMenu(FALLBACK_FOOTER_MENU, pathPrefix);

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
              ? localizeInternalUrl(policyPath, pathPrefix)
              : localizeInternalUrl(normalizedUrl, pathPrefix),
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

/** Response data of this module's Storefront operations, by operation name. */
export interface MenuOperations {
  RemixNavigation: StorefrontApi.ResultOf<typeof NAVIGATION_QUERY>;
  RemixProductNavigation: StorefrontApi.ResultOf<
    typeof PRODUCT_NAVIGATION_QUERY
  >;
}
