import type { LinksFunction, LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { defer } from "@shopify/remix-oxygen";
import {
  Await,
  useLoaderData,
  Link,
  type MetaFunction,
} from "@remix-run/react";
import { Suspense } from "react";
import { Image } from "@shopify/hydrogen";
import { CollectionGrid } from "~/components/CollectionGrid";
import type {
  FeaturedCollectionFragment,
  RecommendedProductsQuery,
} from "storefrontapi.generated";
import featuredFrame from "~/assets/featured-frame.svg?url";

export const meta: MetaFunction = () => {
  return [{ title: "The Remix Store | Home" }];
};

export const links: LinksFunction = () => {
  return [
    {
      rel: "preload",
      href: featuredFrame,
      as: "image",
      type: "image/svg+xml",
    },
  ];
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
  const data = useLoaderData<typeof loader>();
  return (
    <>
      <FeaturedCollection collection={data.featuredCollection} />
      <RecommendedProducts products={data.recommendedProducts} />
    </>
  );
}

function FeaturedCollection({
  collection,
}: {
  collection: FeaturedCollectionFragment | undefined | null;
}) {
  if (!collection) return null;
  const image = collection?.image;
  return (
    <Link
      className="relative block bg-neutral-200 px-16 pb-8 dark:bg-neutral-800"
      to={`/collections/${collection.handle}`}
    >
      <div className="relative mx-auto max-w-7xl">
        <img className="aspect-[1290/426]" src={featuredFrame} alt="" />
        {image && (
          <Image
            className="absolute top-1/2 -translate-y-1/2"
            data={image}
            sizes="100vw"
            alt=""
          />
        )}
      </div>
    </Link>
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
  fragment FeaturedCollection on Collection {
      id
      title
      image {
        id
        url
        altText
        width
        height
      }
      handle
    }

  query FeaturedCollection($country: CountryCode, $language: LanguageCode)
    @inContext(country: $country, language: $language) {
    collectionByHandle(handle: "featured") {
      ...FeaturedCollection
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
