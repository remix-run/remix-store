import { Storefront } from "@shopify/hydrogen";
import type { Shop } from "@shopify/hydrogen/storefront-api-types";

type PolicyHandle =
  | "privacy-policy"
  | "shipping-policy"
  | "terms-of-service"
  | "refund-policy";
type PolicyKey = keyof Pick<
  Shop,
  "privacyPolicy" | "shippingPolicy" | "termsOfService" | "refundPolicy"
>;

const POLICY_HANDLE_MAP: Record<PolicyHandle, PolicyKey> = {
  "privacy-policy": "privacyPolicy",
  "shipping-policy": "shippingPolicy",
  "terms-of-service": "termsOfService",
  "refund-policy": "refundPolicy",
} as const;

function getPolicyKey(handle: string): PolicyKey {
  if (!isPolicyHandle(handle)) {
    throw new Response(`Invalid policy handle: ${handle}`, { status: 404 });
  }
  return POLICY_HANDLE_MAP[handle];
}

function isPolicyHandle(handle: string): handle is PolicyHandle {
  return handle in POLICY_HANDLE_MAP;
}

export async function getPolicyData(
  storefront: Storefront,
  { handle }: { handle: string },
) {
  const policyKey = getPolicyKey(handle);

  const data = await storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyKey]: true,
      language: storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyKey];

  if (!policy) {
    throw new Response("Could not find the policy", { status: 404 });
  }

  return policy;
}

const POLICY_CONTENT_QUERY = `#graphql
  fragment Policy on ShopPolicy {
    body
    handle
    id
    title
    url
  }
  query Policy(
    $country: CountryCode
    $language: LanguageCode
    $privacyPolicy: Boolean!
    $refundPolicy: Boolean!
    $shippingPolicy: Boolean!
    $termsOfService: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      shippingPolicy @include(if: $shippingPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
      refundPolicy @include(if: $refundPolicy) {
        ...Policy
      }
    }
  }
` as const;
