import { Storefront } from "@shopify/hydrogen";

import type { ProductQueryVariables } from "storefrontapi.generated";

export async function getProductData(
  storefront: Storefront,
  { variables }: { variables: ProductQueryVariables },
) {
  const { product } = await storefront.query(PRODUCT_QUERY, { variables });

  if (!product?.id) {
    throw new Response("Product not found", { status: 404 });
  }

  // Note: we only support filter options for product variants
  if (product.options) {
    product.options = product.options.filter(
      (option) => option.name === "Size",
    );
  }

  return product;
}

export const PRODUCT_IMAGE_FRAGMENT = `#graphql
  fragment ProductImage on Image {
    id
    altText
    url
    width
    height
  }
` as const;

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      ...ProductImage
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
  ${PRODUCT_IMAGE_FRAGMENT}
` as const;

const PRODUCT_DETAIL_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    description
    encodedVariantExistence
    encodedVariantAvailability
    category {
      name
    }
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    images(first: 5) {
      nodes {
        ...ProductImage
      }
    }
    seo {
      description
      title
    }
    customDescription: metafield(key: "description", namespace: "custom") {
      value
    }
    technicalDescription: metafield(key: "technical_description", namespace: "custom") {
      value
    }
    availableForSale
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_DETAIL_FRAGMENT}
` as const;
