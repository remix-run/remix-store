import { json, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useLoaderData, Link } from "@remix-run/react";
import { Image } from "~/components/Image";

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
    <div className="px-9 pb-12">
      <Image
        className="rounded-3xl"
        // TODO: figure out how to get this data from GraphQL
        data={{
          url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/help-banner.png?v=1719583076",
          width: 1368,
          height: 300,
          altText: "",
        }}
        sizes="100vw"
      />
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div className="rounded-3xl bg-neutral-100 p-12 dark:bg-neutral-700">
          <h1>Info & Help</h1>
          <p className="pt-6">
            Remix is a full stack web framework that lets you focus on the user
            interface and work back through web standards to deliver a fast,
            slick, and resilient user experience. People are gonna love using
            your stuff.
          </p>
        </div>
        <div className="rounded-3xl bg-neutral-100 p-12 dark:bg-neutral-700">
          <h2 className="font-body text-2xl tracking-normal">
            {shippingPolicy.title}
          </h2>
          <div
            className="policy-container flex flex-col gap-9 pt-6"
            dangerouslySetInnerHTML={{ __html: shippingPolicy.body }}
          />
          <h2 className="pt-6 font-body text-2xl tracking-normal">
            {refundPolicy.title}
          </h2>
          <div
            className="policy-container flex flex-col gap-9 pt-6"
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
