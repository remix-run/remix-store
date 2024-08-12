import { json, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData } from "@remix-run/react";
import { Hero } from "~/components/hero";

export async function loader({ context }: LoaderFunctionArgs) {
  const data = await context.storefront.query(POLICIES_QUERY);

  const { privacyPolicy } = data.shop;

  if (!privacyPolicy) {
    throw new Response("No policies found", { status: 404 });
  }

  return json({ privacyPolicy });
}

export default function Policies() {
  const { privacyPolicy } = useLoaderData<typeof loader>();

  return (
    <div className="px-9 pb-12">
      <Hero subtitle="resources" title={privacyPolicy.title} />
      <div className="mt-3 rounded-3xl bg-neutral-100 p-12 dark:bg-neutral-700">
        <h1>{privacyPolicy.title}</h1>
        <div
          className="policy-container flex flex-col gap-9 pt-9"
          dangerouslySetInnerHTML={{ __html: privacyPolicy.body }}
        />
      </div>
    </div>
  );
}

const POLICIES_QUERY = `#graphql
  query PrivacyPolicy ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    shop {
      privacyPolicy {
        id
        title
        body
      }
    }
  }
` as const;
