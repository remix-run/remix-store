import {
  Cache,
  gql,
  StorefrontApiError,
  StorefrontTimeoutError,
  type StorefrontApi,
} from "@shopify/hydrogen";
import type { SerializableObject } from "remix/ui";

import type {
  AppStorefrontClient,
  StorefrontQueryFailureCause,
  StorefrontQueryResult,
} from "./storefront.ts";

const POLICY_HANDLES = {
  "privacy-policy": "privacyPolicy",
  "refund-policy": "refundPolicy",
  "shipping-policy": "shippingPolicy",
  "terms-of-service": "termsOfService",
} as const;

export type PolicyHandle = keyof typeof POLICY_HANDLES | "contact-information";

export type PolicyData = SerializableObject & {
  body: string;
  handle: PolicyHandle;
  id: string;
  title: string;
};

const POLICY_FRAGMENT = gql(`
  fragment RemixPolicyFields on ShopPolicy {
    body
    handle
    id
    title
  }
`);

const POLICY_QUERY = gql(
  `
    query RemixPolicy(
      $country: CountryCode
      $language: LanguageCode
      $privacyPolicy: Boolean!
      $refundPolicy: Boolean!
      $shippingPolicy: Boolean!
      $termsOfService: Boolean!
    ) @inContext(country: $country, language: $language) {
      shop {
        privacyPolicy @include(if: $privacyPolicy) {
          ...RemixPolicyFields
        }
        refundPolicy @include(if: $refundPolicy) {
          ...RemixPolicyFields
        }
        shippingPolicy @include(if: $shippingPolicy) {
          ...RemixPolicyFields
        }
        termsOfService @include(if: $termsOfService) {
          ...RemixPolicyFields
        }
      }
    }
  `,
  [POLICY_FRAGMENT],
);

const CONTACT_QUERY = gql(`
  query RemixContact(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
  ) @inContext(country: $country, language: $language) {
    page(handle: $handle) {
      body
      id
      title
    }
  }
`);

const STABLE_CACHE = Cache.long({ staleIfError: { days: 7 } });
type PolicyKey = (typeof POLICY_HANDLES)[keyof typeof POLICY_HANDLES];
type PolicyQueryData = StorefrontApi.ResultOf<typeof POLICY_QUERY>;

export function isPolicyHandle(handle: string): handle is PolicyHandle {
  return (
    handle === "contact-information" || Object.hasOwn(POLICY_HANDLES, handle)
  );
}

export async function queryPolicy(
  storefront: AppStorefrontClient,
  handle: PolicyHandle,
): Promise<StorefrontQueryResult<PolicyData | null>> {
  try {
    if (handle === "contact-information") {
      let result = await storefront.graphql(CONTACT_QUERY, {
        cache: STABLE_CACHE,
        variables: { handle: "contact" },
      });
      if (result.errors || !result.data) {
        return queryFailure(
          "The Storefront API did not return contact information.",
          result.errors,
        );
      }
      let page = result.data.page;
      return {
        ok: true,
        data: page
          ? {
              body: page.body,
              handle,
              id: page.id,
              title: page.title,
            }
          : null,
      };
    }

    let policyKey = POLICY_HANDLES[handle];
    let result = await storefront.graphql(POLICY_QUERY, {
      cache: STABLE_CACHE,
      variables: {
        privacyPolicy: false,
        refundPolicy: false,
        shippingPolicy: false,
        termsOfService: false,
        [policyKey]: true,
      },
    });
    if (result.errors || !result.data) {
      return queryFailure(
        "The Storefront API did not return policy content.",
        result.errors,
      );
    }

    let policy = policyFrom(result.data, policyKey);
    return {
      ok: true,
      data: policy
        ? {
            body: policy.body,
            handle,
            id: policy.id,
            title: policy.title,
          }
        : null,
    };
  } catch (error) {
    if (
      !(error instanceof StorefrontApiError) &&
      !(error instanceof StorefrontTimeoutError)
    ) {
      throw error;
    }
    return queryFailure("The Storefront API request failed.", error);
  }
}

function policyFrom(data: PolicyQueryData, key: PolicyKey) {
  return data.shop[key];
}

function queryFailure(message: string, errors: StorefrontQueryFailureCause) {
  return { ok: false, message, errors } as const;
}
