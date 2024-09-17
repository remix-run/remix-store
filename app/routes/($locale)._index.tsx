import { Suspense } from "react";
import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { defer } from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaFunction } from "@remix-run/react";
import { Hero } from "~/components/hero";
import { FiltersToolbar } from "~/components/filters";
import {
  COLLECTION_VIDEO_FRAGMENT,
  PRODUCT_ITEM_FRAGMENT,
} from "~/lib/fragments";
import { CollectionGrid } from "~/components/collection-grid";
import type { RecommendedProductsQuery } from "storefrontapi.generated";

export const meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export async function loader(args: LoaderFunctionArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return defer({ ...deferredData, ...criticalData });
}

/**
 * Load data necessary for rendering content above the fold. This is the critical data
 * needed to render the page. If it's unavailable, the whole page should 400 or 500 error.
 */
async function loadCriticalData({ context }: LoaderFunctionArgs) {
  const [collectionData] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY, {
      variables: {
        handle: context.featuredCollection,
      },
    }),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    featuredCollection: collectionData.collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({ context }: LoaderFunctionArgs) {
  const recommendedProducts = context.storefront
    .query(RECOMMENDED_PRODUCTS_QUERY)
    .catch((error) => {
      // Log query errors, but don't throw them so the page can still render
      console.error(error);
      return null;
    });

  return {
    recommendedProducts,
  };
}

export default function Homepage() {
  const { featuredCollection, recommendedProducts } =
    useLoaderData<typeof loader>();

  return (
    <>
      {featuredCollection ? (
        <Hero
          video={
            featuredCollection.video?.reference?.__typename === "Video"
              ? featuredCollection.video?.reference
              : undefined
          }
          image={featuredCollection.image}
          title={featuredCollection.title}
          subtitle={featuredCollection.description}
          href={{
            text: "shop collection",
            to: `/collections/${featuredCollection.handle}`,
          }}
        />
      ) : null}
      <FiltersToolbar />
      <RecommendedProducts products={recommendedProducts} />
    </>
  );
}

function RecommendedProducts({
  products,
}: {
  products: Promise<RecommendedProductsQuery | null>;
}) {
  return (
    <>
      <Suspense fallback={<div>Loading...</div>}>
        <Await resolve={products}>
          {(response) => <CollectionGrid products={response?.products.nodes} />}
        </Await>
      </Suspense>
    </>
  );
}

export const FEATURED_COLLECTION_QUERY = `#graphql
  ${COLLECTION_VIDEO_FRAGMENT}
  query FeaturedCollection($country: CountryCode, $language: LanguageCode, $handle: String!)
    @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      title
      description
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
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 6, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...ProductItem
      }
    }
  }
` as const;
