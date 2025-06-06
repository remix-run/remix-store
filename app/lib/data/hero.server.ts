import type { Storefront } from "@shopify/hydrogen";
import type { ProductImageFragment } from "storefrontapi.generated";
import { PRODUCT_IMAGE_FRAGMENT } from "./product.server";

export type HeroData = {
  masthead: ProductImageFragment;
  assetImages: Array<{
    image: ProductImageFragment;
  }>;
  product: {
    handle: string;
    title: string;
  };
};

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

  let mastheadReference = hero?.masthead?.reference;
  if (
    mastheadReference?.__typename !== "MediaImage" ||
    !mastheadReference.image
  ) {
    throw new Response("Hero masthead image not found", { status: 500 });
  }

  let product = hero?.product?.reference;
  if (product?.__typename !== "Product") {
    throw new Response("Hero product not found", { status: 500 });
  }

  let assetImagesNodes = hero?.assetImages?.references?.nodes;
  if (!assetImagesNodes || assetImagesNodes.length === 0) {
    throw new Response("Hero asset images not found", { status: 500 });
  }

  let assetImages = assetImagesNodes.map((node) => {
    if (node.__typename !== "MediaImage" || !node.image) {
      throw new Response("Hero asset image not found", { status: 500 });
    }

    let url = `${node.image.url}?width=1600&height=900&crop=center`;

    return { image: { ...node.image, url } };
  });

  return {
    masthead: mastheadReference.image,
    assetImages,
    product: {
      handle: product.handle,
      title: product.title,
    },
  };
}

let HERO_QUERY = `#graphql
  ${PRODUCT_IMAGE_FRAGMENT}
  query Hero (
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    hero: metaobject(handle: {handle: "hero_1", type: "hero"}) {
      masthead: field(key: "masthead") {
        reference {
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
      product: field(key: "product") {
        reference {
          __typename
          ... on Product {
            handle
            title
          }
        }
      }
    }
  }
` as const;
