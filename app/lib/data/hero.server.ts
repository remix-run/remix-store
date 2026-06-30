import type { Storefront } from "@shopify/hydrogen";
import type { ProductImageFragment } from "storefrontapi.generated";
import { PRODUCT_IMAGE_FRAGMENT } from "./product.server";

export type HeroData = {
  assetImages: Array<{
    image: ProductImageFragment;
  }>;
  collection: {
    handle: string;
  };
};

type HeroAssetImageNode = {
  __typename?: string;
  image?: ProductImageFragment | null;
};

function buildHeroAssetUrl(imageUrl: string) {
  let url = new URL(imageUrl);
  url.searchParams.set("width", "1600");
  url.searchParams.set("height", "900");
  url.searchParams.set("crop", "center");
  return url.toString();
}

export async function getHeroData(storefront: Storefront): Promise<HeroData> {
  let { hero, errors } = await storefront.query(HERO_QUERY, {
    cache: storefront.CacheLong(),
  });

  if (errors) {
    console.error(errors);
    throw new Error("Failed to fetch hero data");
  }

  if (!hero) {
    throw new Response("Hero data not found", { status: 404 });
  }

  let collection = hero?.collection?.reference;
  if (collection?.__typename !== "Collection") {
    throw new Response("Hero collection not found", { status: 500 });
  }

  let assetImagesNodes = hero?.assetImages?.references?.nodes;
  if (!assetImagesNodes || assetImagesNodes.length === 0) {
    throw new Response("Hero asset images not found", { status: 500 });
  }

  let assetImages = assetImagesNodes.map((node: HeroAssetImageNode) => {
    if (node.__typename !== "MediaImage" || !node.image) {
      throw new Response("Hero asset image not found", { status: 500 });
    }

    let url = buildHeroAssetUrl(node.image.url);

    return { image: { ...node.image, url } };
  });

  return {
    assetImages,
    collection: {
      handle: collection.handle,
    },
  };
}

let HERO_QUERY = `#graphql
  ${PRODUCT_IMAGE_FRAGMENT}
  query Hero (
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    hero: metaobject(handle: {handle: "remix-3-drop-playground", type: "hero"}) {
      assetImages: field(key: "asset_images") {
        references(first: 100) {
          nodes {
            __typename
            ... on MediaImage {
              id
              alt
              image {
                ...ProductImage
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
  }
` as const;
