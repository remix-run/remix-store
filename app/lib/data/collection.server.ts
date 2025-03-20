import type { Storefront } from "@shopify/hydrogen";
import { PRODUCT_IMAGE_FRAGMENT } from "~/lib/fragments";
// import { getFocalPoint } from "./image-utils";

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
  "id" | "handle" | "title" | "description" | "seo" | "image"
> & {
  // image:
  //   | (ProductImageFragment & { focalPoint?: { x: number; y: number } })
  //   | null;
  productsPageInfo: PageInfo;
  products: CollectionProductData[];
};

export async function getCollectionQuery(
  storefront: Storefront,
  { variables }: { variables: CollectionQueryVariables },
): Promise<CollectionData> {
  try {
    let { collection } = await storefront.query(COLLECTION_QUERY, {
      variables,
    });

    if (!collection) {
      throw new Error("Collection not found");
    }

    let products = collection.products.nodes;

    // Extract focal point from collection image if available
    const collectionImage = collection.image
      ? {
          ...collection.image,
          // focalPoint: getFocalPoint(collection.image.presentation?.asJson),
        }
      : null;

    return {
      ...collection,
      image: collectionImage,
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
    console.error(error);
    // TODO: handle errors/missing data better
    return {
      id: "",
      handle: "",
      title: "",
      description: "",
      products: [],
      seo: {
        title: "",
      },
      image: null,
      productsPageInfo: {
        hasPreviousPage: false,
        hasNextPage: false,
        endCursor: "",
        startCursor: "",
      },
    };
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
      image {
        ...ProductImage
        # sadly this doesn't work, gotta figure out another way to get the focal point for collection images
        # presentation {
        #   id
        #   asJson(format: IMAGE)
        # }
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
