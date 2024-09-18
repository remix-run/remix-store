import { Section } from "./components";
import { Hero } from "~/components/hero";
import type { LoaderFunctionArgs } from "@remix-run/server-runtime";
import { useLoaderData } from "@remix-run/react";
import {
  FEATURED_COLLECTION_HANDLE,
  FEATURED_COLLECTION_QUERY,
} from "~/routes/($locale)._index";

export async function loader({ context }: LoaderFunctionArgs) {
  const { featuredCollection } = await context.storefront.query(
    FEATURED_COLLECTION_QUERY,
    {
      variables: {
        handle: FEATURED_COLLECTION_HANDLE,
      },
    },
  );

  return { featuredCollection };
}

export default function Buttons() {
  const { featuredCollection } = useLoaderData<typeof loader>();

  if (!featuredCollection) {
    return <h1>No collection found</h1>;
  }
  const { title, handle, image, video } = featuredCollection;
  const description = featuredCollection.featuredDescription?.value;

  return (
    <div className="-mx-9 bg-neutral-100 dark:bg-neutral-700">
      <Section title="Hero component -- video, title, subtitle, link">
        <Hero
          title={title}
          subtitle={description}
          image={image}
          video={
            video?.reference?.__typename === "Video"
              ? video?.reference
              : undefined
          }
          href={{
            text: "shop collection",
            to: `/collections/${handle}`,
          }}
        />
      </Section>
      <Section title="Hero component -- image, title, subtitle, link">
        <Hero
          title={title}
          subtitle={description}
          image={image}
          href={{
            text: "shop collection",
            to: `/collections/${handle}`,
          }}
        />
      </Section>

      <Section
        title="Hero component -- with/without subtitle, no link"
        className="space-y-8"
      >
        <Hero title={title} subtitle={description} image={image} />
        <Hero title={title} image={image} />
      </Section>
      <Section title="Hero component -- Title only">
        <div />
      </Section>
    </div>
  );
}
