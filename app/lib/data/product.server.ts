import { Storefront } from "@shopify/hydrogen";

import type {
  ProductQueryVariables,
  ProductVariantFragment,
  ProductVariantsQueryVariables,
} from "storefrontapi.generated";

export async function getProductData(
  storefront: Storefront,
  { variables }: { variables: ProductQueryVariables },
) {
  const { product } = await storefront.query(PRODUCT_QUERY, { variables });

  if (!product?.id) {
    throw new Response("Product not found", { status: 404 });
  }

  const firstVariant = product.variants.nodes[0];
  const firstVariantIsDefault = Boolean(
    firstVariant.selectedOptions.find(
      (option) => option.name === "Title" && option.value === "Default Title",
    ),
  );

  // Note: we only support filter options for product variants
  product.options = product.options.filter((option) => option.name === "Size");

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  }

  return product;
}

export async function getProductVariants(
  storefront: Storefront,
  { variables }: { variables: ProductVariantsQueryVariables },
): Promise<ProductVariantFragment[]> {
  const variants = await storefront.query(VARIANTS_QUERY, {
    variables,
  });

  return variants.product?.variants.nodes || [];
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
    category {
      name
    }
    options {
      name
      optionValues {
        name
      }
    }
    selectedVariant: variantBySelectedOptions(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    variants(first: 1) {
      nodes {
        ...ProductVariant
      }
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
    description: metafield(key: "description", namespace: "custom") {
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

const PRODUCT_VARIANTS_FRAGMENT = `#graphql
  fragment ProductVariants on Product {
    variants(first: 250) {
      nodes {
        ...ProductVariant
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const VARIANTS_QUERY = `#graphql
  query ProductVariants(
    $country: CountryCode
    $language: LanguageCode
    $handle: String!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...ProductVariants
    }
  }
  ${PRODUCT_VARIANTS_FRAGMENT}
` as const;
