import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { defer } from "@shopify/remix-oxygen";
import { useLoaderData, type MetaFunction } from "@remix-run/react";
import { Hero } from "~/components/hero";
import { FiltersToolbar } from "~/components/filters";
import {
  COLLECTION_VIDEO_FRAGMENT,
  PRODUCT_ITEM_FRAGMENT,
} from "~/lib/fragments";
import { CollectionGrid } from "~/components/collection-grid";

export const FEATURED_COLLECTION_HANDLE = "remix-logo-apparel";

export const meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export async function loader(args: LoaderFunctionArgs) {
  const { context } = args;
  const featuredQuery = context.storefront.query(FEATURED_COLLECTION_QUERY, {
    variables: {
      handle: FEATURED_COLLECTION_HANDLE,
    },
  });
  const recommendedQuery = context.storefront.query(
    RECOMMENDED_PRODUCTS_QUERY,
    { variables: { first: 8 } },
  );

  const [{ featuredCollection }, { products }] = await Promise.all([
    featuredQuery,
    recommendedQuery,
  ]);

  return defer({ featuredCollection, products });
}

export default function Homepage() {
  const { featuredCollection, products } = useLoaderData<typeof loader>();

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
          subtitle={featuredCollection.featuredDescription?.value}
          href={{
            text: "shop collection",
            to: `/collections/${featuredCollection.handle}`,
          }}
        />
      ) : null}
      <FiltersToolbar />
      <CollectionGrid products={products.nodes} />;
    </>
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

// TODO: do we want to make this a little more curated?
const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode, $first: Int)
    @inContext(country: $country, language: $language) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...ProductItem
      }
    }
  }
` as const;
