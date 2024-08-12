import {
  defer,
  redirect,
  type LoaderFunctionArgs,
} from "@shopify/remix-oxygen";
import { useLoaderData, type MetaFunction } from "@remix-run/react";
import {
  Pagination,
  getPaginationVariables,
  Analytics,
} from "@shopify/hydrogen";
import { PRODUCT_ITEM_FRAGMENT } from "~/lib/fragments";
import { CollectionGrid } from "~/components/CollectionGrid";
import { Hero } from "~/components/hero";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = `The Remix Store`;

  if (data?.collection.seo?.title) {
    title += ` | ${data.collection.seo.title}`;
  } else if (data?.collection.title) {
    title += ` | ${data.collection.title} Collection`;
  }

  return [{ title }];
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
async function loadCriticalData({
  context,
  params,
  request,
}: LoaderFunctionArgs) {
  const { handle } = params;
  const { storefront } = context;
  const paginationVariables = getPaginationVariables(request, {
    pageBy: 8,
  });

  if (!handle) {
    throw redirect("/collections");
  }

  const [{ collection }] = await Promise.all([
    storefront.query(COLLECTION_QUERY, {
      variables: { handle, ...paginationVariables },
      // Add other queries here, so that they are loaded in parallel
    }),
  ]);

  if (!collection) {
    throw new Response("Collection not found", {
      status: 404,
    });
  }

  return {
    collection,
  };
}

/**
 * Load data for rendering content below the fold. This data is deferred and will be
 * fetched after the initial page load. If it's unavailable, the page should still 200.
 * Make sure to not throw any errors here, as it will cause the page to 500.
 */
function loadDeferredData({ context }: LoaderFunctionArgs) {
  return {};
}

export default function Collection() {
  const { collection } = useLoaderData<typeof loader>();

  return (
    <div>
      <div className="px-9">
        <Hero
          title={collection.title}
          subtitle="now browsing"
          image={collection.image}
        />
      </div>
      <Pagination connection={collection.products}>
        {({ nodes, isLoading, PreviousLink, NextLink }) => (
          <>
            <PreviousLink>
              {isLoading ? "Loading..." : <span>↑ Load previous</span>}
            </PreviousLink>
            <CollectionGrid products={nodes} />
            <br />
            <NextLink>
              {isLoading ? "Loading..." : <span>Load more ↓</span>}
            </NextLink>
          </>
        )}
      </Pagination>
      <Analytics.CollectionView
        data={{
          collection: {
            id: collection.id,
            handle: collection.handle,
          },
        }}
      />
    </div>
  );
}

// NOTE: https://shopify.dev/docs/api/storefront/2022-04/objects/collection
const COLLECTION_QUERY = `#graphql
  ${PRODUCT_ITEM_FRAGMENT}
  query Collection(
    $handle: String!
    $country: CountryCode
    $language: LanguageCode
    $first: Int
    $last: Int
    $startCursor: String
    $endCursor: String
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      image {
        id
        url
        altText
        width
        height
      }
      seo {
        title
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
      ) {
        nodes {
          ...ProductItem
        }
        pageInfo {
          hasPreviousPage
          hasNextPage
          endCursor
          startCursor
        }
      }
    }
  }
` as const;
