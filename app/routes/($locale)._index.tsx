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
import { Image } from "@shopify/hydrogen";
import {
  getLookbookEntries,
  type LookbookEntry as LookbookEntryProps,
} from "~/lib/lookbook.server";
import Icon from "~/components/icon";

// TODO: Add icons for buttons

export let FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

let loadRunnerImage = {
  altText: "Silhouette of a runner made of white circles",
  height: 1081,
  width: 1081,
  url: "https://cdn.shopify.com/s/files/1/0655/4127/5819/files/load_runner.gif?v=1739987429",
};

export let meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export async function loader({ request, context }: LoaderFunctionArgs) {
  let { storefront } = context;
  let featuredQuery = storefront.query(FEATURED_COLLECTION_QUERY, {
    variables: {
      handle: FEATURED_COLLECTION_HANDLE,
    },
  });

  let url = new URL(request.url);
  let { searchParams } = url;
  let variables = {
    handle: "all",
    first: 8,
    ...getFilterQueryVariables(searchParams),
  };

  let top8Query = storefront.query(COLLECTION_QUERY, { variables });

  let lookbookEntriesQuery = getLookbookEntries(storefront);

  let [{ featuredCollection }, { collection }, lookbookEntries] =
    await Promise.all([featuredQuery, top8Query, lookbookEntriesQuery]);

  let products = collection?.products;
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
  let { featuredCollection, products, lookbookEntries } =
    useLoaderData<typeof loader>();

  let [firstEntry, ...restEntries] = lookbookEntries;

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
      {firstEntry && (
        <LookbookEntry key={firstEntry.image.id} {...firstEntry} />
      )}
      <div className="flex h-[800px] items-center justify-center gap-4 bg-[#1E1EC4]">
        <div className="w-[65%]">
          <Image
            className="h-full w-full"
            sizes="calc(100vw * 0.65)"
            data={loadRunnerImage}
          />
        </div>
      </div>
      {restEntries.map((entry) => (
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
          sizes="100vw"
          className="h-full w-full object-cover object-center"
          data={image}
        />
      </div>
      {product && (
        <Link
          className="group absolute bottom-9 left-9 flex h-16 items-center justify-center gap-2.5 rounded-[54px] bg-white px-6 py-4 text-center text-xl font-semibold text-black no-underline"
          to={`/products/${product.handle}`}
        >
          <Icon
            name="fast-forward"
            className="icon-animation -ml-2.5 size-8 max-w-0 opacity-0 group-hover:ml-0 group-hover:max-w-[32px] group-hover:opacity-100"
            aria-hidden="true"
          />
          <span>Shop</span>
          <span className="text-[28px]">·</span>
          <span>${Math.floor(Number(product.price.amount))}</span>
        </Link>
      )}
    </div>
  );
}

export let FEATURED_COLLECTION_QUERY = `#graphql
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
