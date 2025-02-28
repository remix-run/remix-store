import type { Storefront } from "@shopify/hydrogen";
import type { ProductImageFragment } from "storefrontapi.generated";
import type { MoneyV2 } from "@shopify/hydrogen/customer-account-api-types";
import { PRODUCT_IMAGE_FRAGMENT } from "./fragments";

export type LookbookEntry = {
  image: ProductImageFragment & { focalPoint?: { x: number; y: number } };
  product?: {
    handle: string;
    price: MoneyV2;
  };
};

export async function getLookbookEntries(
  storefront: Storefront,
): Promise<LookbookEntry[]> {
  let { lookbookEntries, errors } = await storefront.query(LOOKBOOK_QUERY, {
    cache: storefront.CacheLong(),
  });

  if (errors) {
    console.error(errors);
    throw new Error("Failed to fetch lookbook entries");
  }

  // This assumes that the the lookbook entry handles are in order:
  // e.g. "lookbook_entry_1", "lookbook_entry_2", "lookbook_entry_3", etc.
  return lookbookEntries.nodes
    .sort((a, b) => a.handle.localeCompare(b.handle))
    .map((entry) => {
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
            price: product.priceRange.minVariantPrice,
          },
        }),
      };
    });
}

function getFocalPoint(
  presentation: unknown,
): { x: number; y: number } | undefined {
  if (typeof presentation !== "object" || presentation === null) {
    return undefined;
  }

  if (!("focalPoint" in presentation)) {
    return undefined;
  }

  const focalPoint = presentation.focalPoint;
  if (typeof focalPoint !== "object" || focalPoint === null) {
    return undefined;
  }

  if (!("x" in focalPoint) || !("y" in focalPoint)) {
    return undefined;
  }

  const x = Number(focalPoint.x);
  const y = Number(focalPoint.y);

  if (isNaN(x) || isNaN(y)) {
    return undefined;
  }

  return { x, y };
}

export let LOOKBOOK_QUERY = `#graphql
  ${PRODUCT_IMAGE_FRAGMENT}
  query LookbookImages (
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    lookbookEntries: metaobjects(type: "lookbook_entry", first: 5) {
      nodes {
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
` as const;
