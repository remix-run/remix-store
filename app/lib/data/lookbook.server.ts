import type { Storefront } from "@shopify/hydrogen";
import type { ProductImageFragment } from "storefrontapi.generated";
import type { MoneyV2 } from "@shopify/hydrogen/customer-account-api-types";
import { PRODUCT_IMAGE_FRAGMENT } from "./product.server";
import { getFocalPoint } from "~/lib/image-utils";

export type LookbookEntry = {
  image: ProductImageFragment & { focalPoint?: { x: number; y: number } };
  product?: {
    handle: string;
    title: string;
    price: MoneyV2;
  };
};

export async function getLookbookEntries(
  storefront: Storefront,
): Promise<LookbookEntry[]> {
  let { lookbook, errors } = await storefront.query(LOOKBOOK_QUERY, {
    cache: storefront.CacheLong(),
  });

  if (errors) {
    console.error(errors);
    throw new Error("Failed to fetch lookbook");
  }

  if (!lookbook) {
    throw new Response("Lookbook not found", { status: 404 });
  }

  const entriesField = lookbook.entries?.references?.nodes;
  if (!entriesField) {
    return [];
  }

  return entriesField.map((entry) => {
    if (entry.__typename !== "Metaobject" || !entry.fields) {
      throw new Response("Invalid lookbook entry", { status: 500 });
    }

    let lookbookImage = entry.fields.find(
      (field) => field.reference?.__typename === "MediaImage",
    )?.reference;

    if (lookbookImage?.__typename !== "MediaImage" || !lookbookImage.image) {
      throw new Response("Lookbook image not found", { status: 500 });
    }

    let product = entry.fields.find(
      (field) => field.reference?.__typename === "Product",
    )?.reference;

    let focalPoint = getFocalPoint(lookbookImage.presentation?.asJson);

    return {
      image: {
        ...lookbookImage.image,
        focalPoint,
      },
      ...(product?.__typename === "Product" && {
        product: {
          handle: product.handle,
          title: product.title,
          price: product.priceRange.minVariantPrice,
        },
      }),
    };
  });
}

let LOOKBOOK_QUERY = `#graphql
  ${PRODUCT_IMAGE_FRAGMENT}
  query LookbookImages (
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    lookbook: metaobject(handle: {handle: "lookbook_green_drop", type: "lookbook"}) {
      handle
      entries: field(key: "lookbook") {
        references(first: 100) {
          nodes {
            __typename
            ... on Metaobject {
              handle
              fields {
                __typename
                reference {
                  __typename
                  ... on MediaImage {
                    id
                    alt
                    presentation {
                      id
                      asJson(format: IMAGE)
                    }
                    image {
                      ...ProductImage
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
` as const;
