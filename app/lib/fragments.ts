const MERCHANDISE_PRODUCT_FRAGMENT = `#graphql
  fragment MerchadiseProduct on Product {
    handle
    title
    id
    vendor
  }
` as const;

// NOTE: https://shopify.dev/docs/api/storefront/latest/queries/cart
export const CART_QUERY_FRAGMENT = `#graphql
  fragment Money on MoneyV2 {
    currencyCode
    amount
  }
  fragment CartLine on CartLine {
    id
    quantity
    attributes {
      key
      value
    }
    cost {
      totalAmount {
        ...Money
      }
      amountPerQuantity {
        ...Money
      }
      compareAtAmountPerQuantity {
        ...Money
      }
    }
    merchandise {
      ... on ProductVariant {
        id
        availableForSale
        compareAtPrice {
          ...Money
        }
        price {
          ...Money
        }
        requiresShipping
        title
        image {
          id
          url
          altText
          width
          height

        }
        product {
          ...MerchadiseProduct
        }
        selectedOptions {
          name
          value
        }
      }
    }
  }
  fragment CartApiQuery on Cart {
    updatedAt
    id
    checkoutUrl
    totalQuantity
    buyerIdentity {
      countryCode
      customer {
        id
        email
        firstName
        lastName
        displayName
      }
      email
      phone
    }
    lines(first: $numCartLines) {
      nodes {
        ...CartLine
      }
    }
    cost {
      subtotalAmount {
        ...Money
      }
      totalAmount {
        ...Money
      }
      totalDutyAmount {
        ...Money
      }
      totalTaxAmount {
        ...Money
      }
    }
    discountAllocations {
      discountedAmount {
        ...Money
      }
    }
    note
    attributes {
      key
      value
    }
    discountCodes {
      code
      applicable
    }
  }
  ${MERCHANDISE_PRODUCT_FRAGMENT}
` as const;

export const MENU_FRAGMENT = `#graphql
  fragment MenuItem on MenuItem {
    id
    resourceId
    tags
    title
    type
    url
  }
  fragment ChildMenuItem on MenuItem {
    ...MenuItem
  }
  fragment ParentMenuItem on MenuItem {
    ...MenuItem
    items {
      ...ChildMenuItem
    }
  }
  fragment Menu on Menu {
    id
    title
    items {
      ...ParentMenuItem
    }
  }
` as const;

export const FOOTER_QUERY = `#graphql
  query Footer(
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    menu(handle: "footer") {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;

export const PRODUCT_SIDEBAR_MENU_QUERY = `#graphql
  query ProductSidebarMenu(
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(language: $language, country: $country) {
    menu(handle: "product-sidebar-menu") {
      ...Menu
    }
  }
  ${MENU_FRAGMENT}
` as const;
