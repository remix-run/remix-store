import {
  createCartCookie,
  getCartId,
  gql,
  type StorefrontClient,
} from "@shopify/hydrogen";

const DISCOUNT_CART_CREATE_MUTATION = gql(`
  mutation RemixDiscountCartCreate($discountCodes: [String!]) {
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

const CART_DISCOUNT_CODES_UPDATE_MUTATION = gql(`
  mutation RemixCartDiscountCodesUpdate(
    $cartId: ID!
    $discountCodes: [String!]!
  ) {
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
    let result = await storefrontClient.graphql(
      CART_DISCOUNT_CODES_UPDATE_MUTATION,
      { variables: { cartId, discountCodes: [code] } },
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
