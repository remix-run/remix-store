import type { Storefront } from "@shopify/hydrogen";
import { PRODUCT_IMAGE_FRAGMENT } from "./fragments";
import { getFocalPoint, type FocalPoint } from "./image-utils";

import type {
  CollectionQueryVariables,
  CollectionProductFragment,
  CollectionQuery,
  ProductImageFragment,
} from "storefrontapi.generated";
import type { MoneyV2, PageInfo } from "@shopify/hydrogen/storefront-api-types";
export type CollectionProductData = Pick<
  CollectionProductFragment,
  "id" | "handle" | "title" | "images"
> & {
  price: MoneyV2;
};

export type CollectionData = Pick<
  NonNullable<CollectionQuery["collection"]>,
  "id" | "handle" | "title" | "description" | "seo"
> & {
  image: (ProductImageFragment & { focalPoint?: FocalPoint }) | null;
  productsPageInfo: PageInfo;
  products: CollectionProductData[];
};

export async function getCollectionQuery(
  storefront: Storefront,
  { variables }: { variables: CollectionQueryVariables },
): Promise<CollectionData | null> {
  try {
    let { collection } = await storefront.query(COLLECTION_QUERY, {
      variables,
    });

    if (!collection) {
      throw new Error("Collection not found");
    }

    let products = collection.products.nodes;

    let imageReference = collection.image?.reference;
    let image: CollectionData["image"] = null;
    if (imageReference?.__typename === "MediaImage" && imageReference.image) {
      image = {
        ...imageReference.image,
        // Extract focal point from collection image if available
        focalPoint: getFocalPoint(imageReference.presentation?.asJson),
      };
    }

    return {
      ...collection,
      image,
      productsPageInfo: collection.products.pageInfo,
      products: products.map(({ priceRange, ...product }) => {
        return {
          id: product.id,
          handle: product.handle,
          title: product.title,
          images: product.images,
          price: priceRange.maxVariantPrice,
        };
      }),
    };
  } catch (error) {
    throw new Error("Failed to fetch collection");
  }
}

export const COLLECTION_PRODUCT_FRAGMENT = `#graphql
  fragment MoneyProductItem on MoneyV2 {
    amount
    currencyCode
  }
  fragment CollectionProduct on Product {
    id
    handle
    title
    # availableForSale
    priceRange {
      minVariantPrice {
        ...MoneyProductItem
      }
      maxVariantPrice {
        ...MoneyProductItem
      }
    }
    images(first: 2) {
      nodes {
        ...ProductImage
      }
    }
  }
  ${PRODUCT_IMAGE_FRAGMENT}
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
export const COLLECTION_QUERY = `#graphql
  ${COLLECTION_PRODUCT_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $filters: [ProductFilter!]
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image: metafield(key: "featured_photo", namespace: "custom") {
        reference {
          __typename
          ... on MediaImage {
            presentation {
              id
              asJson(format: IMAGE)
            }
            image {
              ...ProductImage
            }
          }
        }
      }
      seo {
        title
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
        sortKey: $sortKey
        reverse: $reverse
        filters: $filters
      ) {
        nodes {
          ...CollectionProduct 
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
