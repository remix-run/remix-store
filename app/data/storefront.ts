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

export type ShellMenusData = SerializableObject & {
  footerMenu: NavigationMenuData;
  navigationMenu: NavigationMenuData;
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

const STABLE_CACHE = Cache.long({ staleIfError: { days: 7 } });

type ShopData = StorefrontApi.ResultOf<typeof SHOP_QUERY>["shop"];
type HomeQueryData = StorefrontApi.ResultOf<typeof HOME_QUERY>;

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

export async function queryHome(
  storefront: AppStorefrontClient,
): Promise<StorefrontQueryResult<HomeData>> {
  try {
    let result = await storefront.graphql(HOME_QUERY, {
      cache: STABLE_CACHE,
    });
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

function normalizeStoreDomain(value: string): string {
  return new URL(value.includes("://") ? value : `https://${value}`).host;
}
