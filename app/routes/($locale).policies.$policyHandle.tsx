import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { PageTitle } from "~/components/page-title";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { policyHandle } = params;

  if (!policyHandle) {
    throw new Response("No handle was passed in", { status: 404 });
  }

  // if (policyHandle === "shipping-policy" || policyHandle === "refund-policy") {
  //   return redirect(`/help`);
  // }

  const policyName = policyHandle.replace(
    /-([a-z])/g,
    (_: unknown, m1: string) => m1.toUpperCase(),
  ) as "privacyPolicy" | "termsOfService";

  const policies = await context.storefront.query(POLICY_QUERY, {
    variables: {
      privacyPolicy: false,
      termsOfService: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = policies.shop?.[policyName];

  if (!policy) {
    throw new Response("Could not find the policy", { status: 404 });
  }

  return data({ policy });
}
export default function Policies() {
  const { policy } = useLoaderData<typeof loader>();
  console.log(policy);

  return (
    <main>
      <PageTitle>{policy.title}</PageTitle>
      <div className="policy-container mx-auto max-w-[700px]">
        <div className="" dangerouslySetInnerHTML={{ __html: policy.body }} />
      </div>

      <div
        // bottom spacer
        className="h-36"
      />
    </main>
  );
}

const POLICY_QUERY = `#graphql
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
    $termsOfService: Boolean!
    $refundPolicy: Boolean!
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
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
`;
