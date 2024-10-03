import { json, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { Hero } from "~/components/hero";

export async function loader({ context }: LoaderFunctionArgs) {
  const data = await context.storefront.query(POLICIES_QUERY);

  const { refundPolicy, shippingPolicy } = data.shop;

  if (!refundPolicy || !shippingPolicy) {
    throw new Response("No policies found", { status: 404 });
  }

  return json({ refundPolicy, shippingPolicy });
}

export default function Policies() {
  const { refundPolicy, shippingPolicy } = useLoaderData<typeof loader>();

  return (
    <div className="policy-container pb-12">
      <Hero subtitle="resources" title="info & help" />
      <div className="mt-[26px] grid gap-3 md:gap-[18px] lg:grid-cols-2">
        <div className="rounded-3xl bg-neutral-100 p-12 dark:bg-neutral-700">
          <h2>{shippingPolicy.title}</h2>
          <div
            className="flex flex-col gap-9 pt-6"
            dangerouslySetInnerHTML={{ __html: shippingPolicy.body }}
          />
        </div>
        <div className="rounded-3xl bg-neutral-100 p-12 dark:bg-neutral-700">
          <h2>{refundPolicy.title}</h2>
          <div
            className="flex flex-col gap-9 pt-6"
            dangerouslySetInnerHTML={{ __html: refundPolicy.body }}
          />
        </div>
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  fragment PolicyItem on ShopPolicy {
    id
    title
    body
  }
  query HelpPolicies ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      shippingPolicy {
        ...PolicyItem
      }
      refundPolicy {
        ...PolicyItem
      }
    }
  }
` as const;
