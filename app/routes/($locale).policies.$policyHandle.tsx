import { json, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { Hero } from "~/components/hero";

export async function loader({ params, context }: LoaderFunctionArgs) {
  const { policyHandle } = params;

  if (!policyHandle) {
    throw new Response("No handle was passed in", { status: 404 });
  }

  if (policyHandle === "shipping-policy" || policyHandle === "refund-policy") {
    return redirect(`/help`);
  }

  const policyName = policyHandle.replace(
    /-([a-z])/g,
    (_: unknown, m1: string) => m1.toUpperCase(),
  ) as "privacyPolicy" | "termsOfService";

  const data = await context.storefront.query(POLICY_QUERY, {
    variables: {
      privacyPolicy: false,
      termsOfService: false,
      [policyName]: true,
      language: context.storefront.i18n?.language,
    },
  });

  const policy = data.shop?.[policyName];

  if (!policy) {
    throw new Response("Could not find the policy", { status: 404 });
  }

  return json({ policy });
}
export default function Policies() {
  const { policy } = useLoaderData<typeof loader>();

  return (
    <div className="policy-container pb-12">
      <Hero subtitle="resources" title={policy.title} />
      <div className="mt-[26px] rounded-3xl bg-neutral-100 px-[24px] py-7 lg:p-9 dark:bg-neutral-700">
        <div
          className="flex flex-col gap-9"
          dangerouslySetInnerHTML={{ __html: policy.body }}
        />
      </div>
    </div>
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
  ) @inContext(language: $language, country: $country) {
    shop {
      privacyPolicy @include(if: $privacyPolicy) {
        ...Policy
      }
      termsOfService @include(if: $termsOfService) {
        ...Policy
      }
    }
  }
`;
