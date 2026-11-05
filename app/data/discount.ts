import {
  createCartCookie,
  getCartId,
  gql,
  type StorefrontApi,
} from "@shopify/hydrogen";

import {
  StorefrontQueryError,
  requireStorefrontData,
  type AppStorefrontClient,
} from "./storefront.ts";

const DISCOUNT_CART_CREATE_MUTATION = gql(`
  mutation RemixDiscountCartCreate(
    $discountCodes: [String!]
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartCreate(input: { discountCodes: $discountCodes }) {
      cart {
        id
      }
      userErrors {
        message
      }
      warnings {
        message
      }
    }
  }
`);

const DISCOUNT_CART_QUERY = gql(`
  query RemixDiscountCart(
    $cartId: ID!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cart(id: $cartId) {
      discountCodes {
        code
      }
    }
  }
`);

const CART_DISCOUNT_CODES_UPDATE_MUTATION = gql(`
  mutation RemixCartDiscountCodesUpdate(
    $cartId: ID!
    $discountCodes: [String!]!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    cartDiscountCodesUpdate(
      cartId: $cartId
      discountCodes: $discountCodes
    ) {
      cart {
        id
      }
      userErrors {
        message
      }
      warnings {
        message
      }
    }
  }
`);

/**
 * Applies one compatibility-link discount, creating a cart when necessary.
 * Throws a Storefront failure when the API errors or rejects the code.
 */
export async function applyDiscountCode(
  storefrontClient: AppStorefrontClient,
  request: Request,
  code: string,
): Promise<Headers> {
  let cartId = getCartId(request);
  let payload;

  if (cartId) {
    let { cart } = requireStorefrontData(
      await storefrontClient.graphql(DISCOUNT_CART_QUERY, {
        variables: { cartId },
      }),
      "Discount cart request failed",
    );
    let discountCodes = [
      ...(cart?.discountCodes.map(({ code }) => code) ?? []),
      code,
    ];
    payload = requireStorefrontData(
      await storefrontClient.graphql(CART_DISCOUNT_CODES_UPDATE_MUTATION, {
        variables: { cartId, discountCodes },
      }),
      "Discount request failed",
    ).cartDiscountCodesUpdate;
  } else {
    payload = requireStorefrontData(
      await storefrontClient.graphql(DISCOUNT_CART_CREATE_MUTATION, {
        variables: { discountCodes: [code] },
      }),
      "Discount request failed",
    ).cartCreate;
  }
  let nextCartId = payload?.cart?.id;
  let userError = payload?.userErrors[0];

  if (userError || !nextCartId) {
    throw new StorefrontQueryError(
      userError?.message ?? "Discount request returned no cart",
    );
  }

  let headers = new Headers();
  if (nextCartId !== cartId)
    headers.append("Set-Cookie", createCartCookie(nextCartId));
  return headers;
}

/** Response data of this module's Storefront operations, by operation name. */
export interface DiscountOperations {
  RemixDiscountCartCreate: StorefrontApi.ResultOf<
    typeof DISCOUNT_CART_CREATE_MUTATION
  >;
  RemixDiscountCart: StorefrontApi.ResultOf<typeof DISCOUNT_CART_QUERY>;
  RemixCartDiscountCodesUpdate: StorefrontApi.ResultOf<
    typeof CART_DISCOUNT_CODES_UPDATE_MUTATION
  >;
}
