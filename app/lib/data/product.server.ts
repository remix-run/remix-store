import { Storefront } from "@shopify/hydrogen";
import {
  PRODUCT_DETAIL_FRAGMENT,
  PRODUCT_VARIANT_FRAGMENT,
} from "../fragments";
import type {
  ProductQueryVariables,
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

  if (firstVariantIsDefault) {
    product.selectedVariant = firstVariant;
  }

  return product;
}

export async function getProductVariants(
  storefront: Storefront,
  { variables }: { variables: ProductVariantsQueryVariables },
) {
  const variants = await storefront.query(VARIANTS_QUERY, {
    variables,
  });

  return variants;
}
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
