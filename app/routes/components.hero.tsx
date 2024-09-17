import { Section } from "./components";
import { Hero } from "~/components/hero";
import type { LoaderFunctionArgs } from "@remix-run/server-runtime";
import { useLoaderData } from "@remix-run/react";
import { FEATURED_COLLECTION_QUERY } from "./($locale)._index";

const imageData = {
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/shirt-hanging.png?v=1726259004",
  width: 1200,
  height: 1200,
  altText: "Remix t-shirt hanging from a rack",
};

export async function loader({ context }: LoaderFunctionArgs) {
  const { collection } = await context.storefront.query(
    FEATURED_COLLECTION_QUERY,
    {
      variables: {
        handle: context.featuredCollection,
      },
    },
  );

  return { collection };
}

export default function Buttons() {
  const { collection } = useLoaderData<typeof loader>();

  if (!collection) {
    return <h1>No collection found</h1>;
  }

  return (
    <div className="-mx-9 bg-neutral-100 dark:bg-neutral-700">
      <Section title="Hero component -- video, title, subtitle, link">
        <Hero
          title={collection.title}
          subtitle={collection.description}
          image={imageData}
          video={
            collection.video?.reference?.__typename === "Video"
              ? collection.video?.reference
              : undefined
          }
          href={{
            text: "shop collection",
            to: `/collections/${collection.handle}`,
          }}
        />
      </Section>
      <Section title="Hero component -- image, title, subtitle, link">
        <Hero
          title={collection.title}
          subtitle={collection.description}
          image={imageData}
          href={{
            text: "shop collection",
            to: `/collections/${collection.handle}`,
          }}
        />
      </Section>

      <Section
        title="Hero component -- with/without subtitle, no link"
        className="space-y-8"
      >
        <Hero
          title={collection.title}
          subtitle={collection.description}
          image={imageData}
        />
        <Hero title={collection.title} image={imageData} />
      </Section>
      <Section title="Hero component -- Title only">
        <div />
      </Section>
    </div>
  );
}
