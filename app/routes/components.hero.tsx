import { Section } from "./components";
import { Hero } from "~/components/hero";
import type { LoaderFunctionArgs } from "@remix-run/server-runtime";
import { useLoaderData } from "@remix-run/react";
import { COLLECTION_VIDEO_FRAGMENT } from "~/lib/fragments";

const imageData = {
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/shirt-hanging.png?v=1726259004",
  width: 1200,
  height: 1200,
  altText: "Remix t-shirt hanging from a rack",
};

export async function loader({ context }: LoaderFunctionArgs) {
  const collection = await context.storefront.query(
    HERO_COMPONENTS_EXAMPLE_DATA,
  );

  return {
    collection,
  };
}

export default function Buttons() {
  const { collection } = useLoaderData<typeof loader>();

  const heroMedia = collection.collectionByHandle?.heroMedia?.reference;

  return (
    <div className="-mx-9 bg-neutral-100 dark:bg-neutral-700">
      <Section title="Hero component" className="p">
        <Hero
          title="Remix Logo Apparel"
          subtitle="New for Fall/Winter 2024"
          image={imageData}
          video={heroMedia?.__typename === "Video" ? heroMedia : undefined}
          href={{
            to: "collections/all",
            text: "shop collection",
          }}
        />
      </Section>

      {/* <Section title="Hero component -- with/without subtitle, no link">
        <div />
      </Section>
      <Section title="Hero component -- Title only">
        <div />
      </Section> */}
    </div>
  );
}

const HERO_COMPONENTS_EXAMPLE_DATA = `#graphql
  ${COLLECTION_VIDEO_FRAGMENT}
  query ExampleCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: "featured") {
      image {
        id
        url
        altText
        width
        height
      }
      heroMedia: metafield(key: "hero_media", namespace: "custom") {
        namespace
        key
        type
        reference {
          __typename
          ... on Video {
            ...CollectionVideo
          }
        }
      }
    }
  }
` as const;
