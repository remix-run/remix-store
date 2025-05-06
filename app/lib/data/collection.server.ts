import type { Storefront } from "@shopify/hydrogen";
import { PRODUCT_IMAGE_FRAGMENT } from "./product.server";

import type {
  CollectionQueryVariables,
  CollectionProductFragment,
  CollectionQuery,
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

    return {
      ...collection,
      productsPageInfo: collection.products.pageInfo,
      products: products.map((fullProductNode) => {
        const { priceRange, ...product } = fullProductNode;
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
