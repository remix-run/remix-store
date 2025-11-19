import type { Storefront } from "@shopify/hydrogen";

import type { ProductQueryVariables } from "storefrontapi.generated";
import { PRODUCT_SIDEBAR_MENU_QUERY } from "../fragments";

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

  return {
    ...product,
    subscribeIfBackInStock: product.subscribeIfBackInStock?.value === "true",
  };
}

export type MenuItem = {
  label: string;
  to: string;
};

export async function getProductMenu(storefront: Storefront) {
  let data = await storefront.query(PRODUCT_SIDEBAR_MENU_QUERY, {
    cache: storefront.CacheLong(),
  });

  let menu: MenuItem[] = [];

  if (!data.menu) {
    return menu;
  }

  for (let item of data.menu.items) {
    if (!item.url) continue;
    menu.push({
      label: item.title,
      to: item.url,
    });
  }
  return menu;
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
    subscribeIfBackInStock: metafield(key: "subscribe_if_back_in_stock", namespace: "custom") {
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
