import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { data } from "@shopify/remix-oxygen";
import { Link, useLoaderData, type MetaFunction } from "@remix-run/react";
import { Hero } from "~/components/hero";
import { FiltersAside, FiltersToolbar } from "~/components/filters";
import { COLLECTION_VIDEO_FRAGMENT } from "~/lib/fragments";
import { CollectionGrid } from "~/components/collection-grid";
import { Button } from "~/components/ui/button";
import { COLLECTION_QUERY } from "~/lib/queries";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import type { LookbookImagesQuery } from "storefrontapi.generated";
import { Image } from "@shopify/hydrogen";
import {
  getLookbookEntries,
  type LookbookEntry as LookbookEntryProps,
} from "~/lib/lookbook.server";

export const FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

export const meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  const { storefront } = context;
  const featuredQuery = storefront.query(FEATURED_COLLECTION_QUERY, {
    variables: {
      handle: FEATURED_COLLECTION_HANDLE,
    },
  });

  const url = new URL(request.url);
  const { searchParams } = url;
  const variables = {
    handle: "all",
    first: 8,
    ...getFilterQueryVariables(searchParams),
  };

  const top8Query = storefront.query(COLLECTION_QUERY, { variables });

  const lookbookEntriesQuery = getLookbookEntries(storefront);

  const [{ featuredCollection }, { collection }, lookbookEntries] =
    await Promise.all([featuredQuery, top8Query, lookbookEntriesQuery]);

  const products = collection?.products;
  if (!products) {
    throw new Response("Something went wrong", { status: 500 });
  }

  return data({
    featuredCollection,
    products,
    lookbookEntries,
  });
}

export default function Homepage() {
  const { featuredCollection, products, lookbookEntries } =
    useLoaderData<typeof loader>();

  return (
    <>
      {/* {featuredCollection ? (
        <Hero
          video={
            featuredCollection.video?.reference?.__typename === "Video"
              ? featuredCollection.video?.reference
              : undefined
          }
          image={featuredCollection.image}
          title={featuredCollection.title}
          subtitle={featuredCollection.featuredDescription?.value}
          href={{
            text: "shop collection",
            to: `/collections/${featuredCollection.handle}`,
          }}
        />
      ) : null} */}
      {lookbookEntries.map((entry) => (
        <LookbookEntry key={entry.image.id} {...entry} />
      ))}
      {/* <FiltersAside>
        <FiltersToolbar itemCount={products.nodes.length} />
      </FiltersAside>
      <CollectionGrid products={products.nodes} />
      <div className="mx-auto mt-20 mb-12 w-[340px]">
        <Button size="lg" asChild>
          <Link to="/collections/all">Shop all items</Link>
        </Button>
      </div> */}
    </>
  );
}

function LookbookEntry({ image, product }: LookbookEntryProps) {
  return (
    <div className="relative h-[1400px]">
      <div className="absolute inset-0">
        <Image
          className="h-full w-full object-cover object-center"
          data={image}
        />
      </div>
      {product && (
        <Link
          className="absolute bottom-9 left-9 min-w-fit rounded-[54px] bg-white px-6 py-4 text-center text-xl font-bold no-underline"
          to={`/products/${product.handle}`}
        >
          Shop · ${Math.floor(Number(product.price.amount))}
        </Link>
      )}
    </div>
  );
}

export const FEATURED_COLLECTION_QUERY = `#graphql
  ${COLLECTION_VIDEO_FRAGMENT}
  query FeaturedCollection($handle: String!, $country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    featuredCollection: collection(handle: $handle) {
      title
      handle
      image {
        ...ProductImage
      }
      video: metafield(key: "featured_video", namespace: "custom") {
        id
        reference {
          __typename
          ... on Video {
            ...CollectionVideo
          }
        }
      }
      featuredDescription: metafield(key: "featured_description", namespace:  "custom") {
        value
      }
    }
  }
` as const;
