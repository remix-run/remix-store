import {
  Cache,
  getSelectedProductOptions,
  gql,
  type StorefrontApi,
} from "@shopify/hydrogen";

import {
  CATALOG_CACHE,
  isStorefrontFailure,
  requireStorefrontData,
  type AppStorefrontClient,
} from "./storefront.ts";

const PRODUCT_VARIANT_FRAGMENT = gql(`
  fragment RemixProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    sku
    product {
      handle
      title
    }
    selectedOptions {
      name
      value
    }
    title
  }
`);

const PRODUCT_QUERY = gql(
  `
    query RemixProduct(
      $handle: String!
      $selectedOptions: [SelectedOptionInput!]!
      $country: CountryCode
      $language: LanguageCode
    ) @inContext(country: $country, language: $language) {
      product(handle: $handle) {
        id
        handle
        title
        vendor
        description
        requiresSellingPlan
        category {
          name
        }
        seo {
          title
          description
        }
        customDescription: metafield(namespace: "custom", key: "description") {
          value
        }
        technicalDescription: metafield(
          namespace: "custom"
          key: "technical_description"
        ) {
          value
        }
        subscribeIfBackInStock: metafield(
          namespace: "custom"
          key: "subscribe_if_back_in_stock"
        ) {
          value
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
        encodedVariantExistence
        encodedVariantAvailability
        options {
          name
          optionValues {
            name
            firstSelectableVariant {
              ...RemixProductVariant
            }
          }
        }
        selectedOrFirstAvailableVariant(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...RemixProductVariant
        }
        adjacentVariants(
          selectedOptions: $selectedOptions
          ignoreUnknownOptions: true
          caseInsensitiveMatch: true
        ) {
          ...RemixProductVariant
        }
        images(first: 8) {
          nodes {
            id
            url
            altText
            width
            height
          }
        }
      }
    }
  `,
  [PRODUCT_VARIANT_FRAGMENT],
);

const PRODUCT_SUBSCRIPTION_QUERY = gql(`
  query RemixBackInStockSubscription(
    $variantId: ID!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    node(id: $variantId) {
      ... on ProductVariant {
        id
        title
        availableForSale
        product {
          handle
          subscribeIfBackInStock: metafield(
            namespace: "custom"
            key: "subscribe_if_back_in_stock"
          ) {
            value
          }
        }
      }
    }
  }
`);

export type ProductData = NonNullable<
  StorefrontApi.ResultOf<typeof PRODUCT_QUERY>["product"]
>;

/** Returns null for an unknown handle; throws when the Storefront API fails. */
export async function queryProduct(
  storefront: AppStorefrontClient,
  handle: string,
  searchParams: URLSearchParams,
): Promise<ProductData | null> {
  let result = await storefront.graphql(PRODUCT_QUERY, {
    variables: {
      handle,
      selectedOptions: getSelectedProductOptions({ searchParams }),
    },
    cache: CATALOG_CACHE,
  });
  return requireStorefrontData(
    result,
    "The Storefront API did not return product data.",
  ).product;
}

/**
 * Looks up a variant with fresh (uncached) data and returns it only when a
 * back-in-stock subscription is allowed: the variant belongs to the product,
 * is sold out, and the product opts in. Returns null otherwise, including
 * during a Storefront outage.
 */
export async function queryBackInStockEligibleVariant(
  storefront: AppStorefrontClient,
  productHandle: string,
  variantId: string,
): Promise<{ productHandle: string; variantTitle: string } | null> {
  let result;
  try {
    result = await storefront.graphql(PRODUCT_SUBSCRIPTION_QUERY, {
      variables: { variantId },
      cache: Cache.none(),
    });
  } catch (error) {
    if (!isStorefrontFailure(error)) throw error;
    return null;
  }

  let variant = result.data?.node;
  if (
    result.errors ||
    !variant ||
    !("availableForSale" in variant) ||
    variant.id !== variantId ||
    variant.availableForSale ||
    variant.product.handle !== productHandle ||
    variant.product.subscribeIfBackInStock?.value.trim().toLowerCase() !==
      "true"
  ) {
    return null;
  }
  return {
    productHandle: variant.product.handle,
    variantTitle: variant.title,
  };
}

/** Response data of this module's Storefront operations, by operation name. */
export interface ProductOperations {
  RemixProduct: StorefrontApi.ResultOf<typeof PRODUCT_QUERY>;
  RemixBackInStockSubscription: StorefrontApi.ResultOf<
    typeof PRODUCT_SUBSCRIPTION_QUERY
  >;
}
