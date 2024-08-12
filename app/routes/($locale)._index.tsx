import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { defer } from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaFunction } from "@remix-run/react";
import { Suspense } from "react";
import { CollectionGrid } from "~/components/CollectionGrid";
import type { RecommendedProductsQuery } from "storefrontapi.generated";

import { Hero } from "~/components/hero";

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
  const [collection] = await Promise.all([
    context.storefront.query(FEATURED_COLLECTION_QUERY),
    // Add other queries here, so that they are loaded in parallel
  ]);

  return {
    featuredCollection: collection.collectionByHandle,
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
        <div className="px-9">
          <Hero
            image={featuredCollection.image}
            title="remix mini skateboard"
            subtitle="build your very own"
            to={`/products/${featuredCollection.products.nodes[0].handle}`}
          />
        </div>
      ) : null}
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

const FEATURED_COLLECTION_QUERY = `#graphql
  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: "featured") {
      image {
        id
        url
        altText
        width
        height
      }
      products(first: 1) {
        nodes {
          handle
        }
      }
    }
  }
` as const;

const RECOMMENDED_PRODUCTS_QUERY = `#graphql
  fragment RecommendedProduct on Product {
    id
    title
    handle
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
    images(first: 1) {
      nodes {
        id
        url
        altText
        width
        height
      }
    }
    gradientColors: metafield(key: "images_gradient_background", namespace: "custom") {
      value
    }
  }
  query RecommendedProducts ($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    products(first: 6, sortKey: UPDATED_AT, reverse: true) {
      nodes {
        ...RecommendedProduct
      }
    }
  }
` as const;
