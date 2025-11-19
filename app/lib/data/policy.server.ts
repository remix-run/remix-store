import type { Storefront } from "@shopify/hydrogen";
import type { Shop } from "@shopify/hydrogen/storefront-api-types";

type PolicyKey = keyof Pick<
  Shop,
  "privacyPolicy" | "shippingPolicy" | "termsOfService" | "refundPolicy"
>;

export async function getPolicyData(
  storefront: Storefront,
  { handle }: { handle: string },
) {
  if (handle === "contact-information") {
    const data = await storefront.query(CONTACT_PAGE_QUERY, {
      variables: {
        handle: "contact",
        language: storefront.i18n?.language,
      },
      cache: storefront.CacheLong(),
    });

    const page = data.page;
    if (!page) {
      throw new Response("Could not find contact information", { status: 404 });
    }

    return {
      body: page.body,
      handle: "contact-information",
      id: page.id,
      title: page.title,
      url: page.onlineStoreUrl,
    };
  }

  const policyKey = transformHandleToKey(handle);

  const data = await storefront.query(POLICY_CONTENT_QUERY, {
    variables: {
      privacyPolicy: false,
      shippingPolicy: false,
      termsOfService: false,
      refundPolicy: false,
      [policyKey]: true,
      language: storefront.i18n?.language,
    },
    cache: storefront.CacheLong(),
  });

  const policy = data.shop?.[policyKey];

  if (!policy) {
    throw new Response("Could not find the policy", { status: 404 });
  }

  return policy;
}

function transformHandleToKey(handle: string): PolicyKey {
  // Transform kebab-case to camelCase
  const key = handle.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

  if (!isPolicyKey(key)) {
    throw new Response(`Invalid policy handle: ${handle}`, { status: 404 });
  }

  // Type assertion is safe because we've validated the handle
  return key;
}

function isPolicyKey(handle: string): handle is PolicyKey {
  return [
    "refundPolicy",
    "privacyPolicy",
    "shippingPolicy",
    "termsOfService",
  ].includes(handle);
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

const CONTACT_PAGE_QUERY = `#graphql
  query ContactPage($handle: String!, $language: LanguageCode) @inContext(language: $language) {
    page(handle: $handle) {
      body
      id
      title
      onlineStoreUrl
    }
  }
` as const;
