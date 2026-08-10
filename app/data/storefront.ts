import {
  Cache,
  gql,
  StorefrontApiError,
  StorefrontTimeoutError,
  type CachingStrategy,
  type StorefrontApi,
  type StorefrontClient,
} from "@shopify/hydrogen";
import type { SerializableObject } from "remix/ui";

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

export type ShellMenusData = SerializableObject & {
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
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

const STABLE_CACHE = Cache.long({ staleIfError: { days: 7 } });

type ShopData = StorefrontApi.ResultOf<typeof SHOP_QUERY>["shop"];

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

export async function queryShellMenus(
  storefront: AppStorefrontClient,
  storeDomain: string,
): Promise<ShellMenusData> {
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

function normalizeStoreDomain(value: string): string {
  return new URL(value.includes("://") ? value : `https://${value}`).host;
}
