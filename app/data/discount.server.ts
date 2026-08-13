import {
  createCartCookie,
  getCartId,
  gql,
  type StorefrontClient,
} from "@shopify/hydrogen";

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

/** Applies one compatibility-link discount, creating a cart when necessary. */
export async function applyDiscountCode(
  request: Request,
  storefrontClient: StorefrontClient,
  code: string,
): Promise<Headers> {
  let cartId = getCartId(request);
  let payload;

  if (cartId) {
    let cartResult = await storefrontClient.graphql(DISCOUNT_CART_QUERY, {
      variables: { cartId },
    });
    if (cartResult.errors || !cartResult.data) {
      throw new Error(
        cartResult.errors?.[0]?.message ?? "Discount cart request failed",
      );
    }
    let discountCodes = [
      ...(cartResult.data.cart?.discountCodes.map(({ code }) => code) ?? []),
      code,
    ];
    let result = await storefrontClient.graphql(
      CART_DISCOUNT_CODES_UPDATE_MUTATION,
      { variables: { cartId, discountCodes } },
    );
    if (result.errors || !result.data) {
      throw new Error(result.errors?.[0]?.message ?? "Discount request failed");
    }
    payload = result.data.cartDiscountCodesUpdate;
  } else {
    let result = await storefrontClient.graphql(DISCOUNT_CART_CREATE_MUTATION, {
      variables: { discountCodes: [code] },
    });
    if (result.errors || !result.data) {
      throw new Error(result.errors?.[0]?.message ?? "Discount request failed");
    }
    payload = result.data.cartCreate;
  }
  let nextCartId = payload?.cart?.id;
  let userError = payload?.userErrors[0];

  if (userError || !nextCartId) {
    throw new Error(userError?.message ?? "Discount request returned no cart");
  }

  let headers = new Headers();
  if (nextCartId !== cartId)
    headers.append("Set-Cookie", createCartCookie(nextCartId));
  return headers;
}
