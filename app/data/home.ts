import { gql, type StorefrontApi } from "@shopify/hydrogen";
import type { SerializableObject } from "remix/component";

import { getFocalPoint, type FocalPoint } from "../lib/image-utils.ts";
import { queryCollection } from "./collection.ts";
import type {
  ImageData,
  ProductCardData,
  ProductMoney,
  ProductPageInfoData,
} from "./public/types.ts";
import {
  isStorefrontFailure,
  requireStorefrontData,
  STABLE_CACHE,
  type AppStorefrontClient,
} from "./storefront.ts";

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

const HOME_QUERY = gql(`
  query RemixHomeEditorial($country: CountryCode, $language: LanguageCode)
  @inContext(country: $country, language: $language) {
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

type HomeQueryData = StorefrontApi.ResultOf<typeof HOME_QUERY>;

const EMPTY_CATALOG = {
  products: [],
  pageInfo: { hasNextPage: false, endCursor: null },
} satisfies Pick<HomeData, "pageInfo" | "products">;

/**
 * Loads the home editorial content and the first page of the full catalog.
 * The editorial query is required; a catalog outage is logged and renders an
 * empty grid so the hero and lookbook still reach the shopper.
 */
export async function queryHome(
  storefront: AppStorefrontClient,
): Promise<HomeData> {
  let [result, catalog] = await Promise.all([
    storefront.graphql(HOME_QUERY, { cache: STABLE_CACHE }),
    queryHomeCatalog(storefront),
  ]);
  let data = requireStorefrontData(
    result,
    "The Storefront API did not return home data.",
  );

  return {
    shop: data.shop,
    hero: toHomeHeroData(data.hero),
    lookbookEntries: toHomeLookbookEntries(data.lookbook),
    ...catalog,
  };
}

async function queryHomeCatalog(
  storefront: AppStorefrontClient,
): Promise<Pick<HomeData, "pageInfo" | "products">> {
  try {
    let collection = await queryCollection(storefront, "all");
    if (!collection) return EMPTY_CATALOG;
    return {
      products: collection.products.nodes,
      pageInfo: collection.products.pageInfo,
    };
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    console.error("[hydrogen] Home catalog query failed", error);
    return EMPTY_CATALOG;
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
          url: node.image.url,
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

type LookbookReferences = NonNullable<
  NonNullable<NonNullable<HomeQueryData["lookbook"]>["entries"]>["references"]
>;
type LookbookEntry = Extract<
  LookbookReferences["nodes"][number],
  { __typename: "Metaobject" }
>;

function toHomeLookbookEntries(
  lookbook: HomeQueryData["lookbook"],
): HomeLookbookEntryData[] {
  return (
    lookbook?.entries?.references?.nodes.flatMap((entry, index) => {
      if (entry.__typename !== "Metaobject") return [];
      let media = lookbookMedia(entry);
      if (!media) return [];
      let { image, presentation } = media;

      return [
        {
          id: entry.id ?? image.id ?? `lookbook-${index}`,
          image: {
            id: image.id,
            url: image.url,
            altText: image.altText,
            width: image.width,
            height: image.height,
          },
          focalPoint: toSerializableFocalPoint(
            getFocalPoint(presentation?.asJson),
          ),
          product: lookbookProduct(entry),
        },
      ];
    }) ?? []
  );
}

function lookbookMedia(entry: LookbookEntry) {
  let reference = entry.fields.find(
    (field) => field.reference?.__typename === "MediaImage",
  )?.reference;
  if (reference?.__typename !== "MediaImage" || !reference.image) return null;
  return { image: reference.image, presentation: reference.presentation };
}

function lookbookProduct(
  entry: LookbookEntry,
): HomeLookbookEntryData["product"] {
  let reference = entry.fields.find(
    (field) => field.reference?.__typename === "Product",
  )?.reference;
  if (reference?.__typename !== "Product") return null;
  let { amount, currencyCode } = reference.priceRange.minVariantPrice;
  return {
    handle: reference.handle,
    price: { amount, currencyCode },
    title: reference.title,
  };
}

function toSerializableFocalPoint(
  point: FocalPoint | undefined,
): (SerializableObject & FocalPoint) | null {
  return point ? { x: point.x, y: point.y } : null;
}

/** Response data of this module's Storefront operations, by operation name. */
export interface HomeOperations {
  RemixHomeEditorial: StorefrontApi.ResultOf<typeof HOME_QUERY>;
}
