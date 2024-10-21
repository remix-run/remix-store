import { Suspense } from "react";
import {
  defer,
  redirect,
  type LoaderFunctionArgs,
} from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaFunction } from "@remix-run/react";
import { Analytics } from "@shopify/hydrogen";
import { PRODUCT_ITEM_FRAGMENT } from "~/lib/fragments";
import { CollectionGrid } from "~/components/collection-grid";
import { Hero } from "~/components/hero";
import { FiltersToolbar } from "~/components/filters";
import { type CollectionQueryVariables } from "storefrontapi.generated";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = `The Remix Store`;

  if (data?.collection.seo?.title) {
    title += ` | ${data.collection.seo.title}`;
  } else if (data?.collection.title) {
    title += ` | ${data.collection.title} Collection`;
  }

  return [{ title }];
};

function getQueryVariables(
  searchParams: URLSearchParams,
): Omit<CollectionQueryVariables, "handle"> {
  const sort = searchParams.get("sort");
  let reverse = false;
  let sortKey: CollectionQueryVariables["sortKey"];

  switch (sort) {
    case "price-high-to-low": {
      reverse = true;
      sortKey = "PRICE";
      break;
    }
    case "price-low-to-high": {
      reverse = false;
      sortKey = "PRICE";
      break;
    }
    case "newest": {
      sortKey = "CREATED";
      reverse = true;
      break;
    }
    case "best-selling": {
      sortKey = "BEST_SELLING";
      break;
    }
  }

  return {
    reverse,
    sortKey,
  };
}

export async function loader({ context, params, request }: LoaderFunctionArgs) {
  const { handle } = params;
  const { storefront } = context;

  if (!handle) {
    throw redirect("/collections");
  }

  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const variables = { handle, ...getQueryVariables(searchParams) };

  // load the initial products we want to SSR
  const { collection } = await storefront.query(COLLECTION_QUERY, {
    variables: { ...variables, first: 8 },
  });

  if (!collection) {
    throw new Response("Collection not found", {
      status: 404,
    });
  }

  const { hasNextPage, endCursor } = collection.products.pageInfo;

  // lazy load the remaining products if any
  if (hasNextPage) {
    const remainingProducts = storefront
      .query(COLLECTION_QUERY, {
        // if we ever have more than 258 products, we need to figure out a
        // different strategy. Honestly, before that point we'll need to
        // paginate, but loading all is fine for now
        variables: {
          ...variables,
          endCursor,
          first: 250,
        },
      })
      // artificial 2 second delay to test loading state
      .then((data) =>
        new Promise((resolve) => setTimeout(resolve, 2000)).then(() => data),
      )
      .then(({ collection }) => collection?.products.nodes);

    return defer({ collection, remainingProducts });
  }

  return defer({ collection, remainingProducts: null });
}

export default function Collection() {
  const { collection, remainingProducts } = useLoaderData<typeof loader>();

  return (
    <div>
      <Hero
        title={collection.title}
        subtitle={collection.description}
        image={collection.image}
      />

      {!remainingProducts ? (
        <>
          <FiltersToolbar itemCount={collection.products.nodes.length} />
          <CollectionGrid products={collection.products.nodes} />
        </>
      ) : (
        <Suspense
          fallback={
            <>
              <FiltersToolbar itemCount={0} />
              <CollectionGrid
                products={collection.products.nodes}
                loadingProductCount={4}
              />
            </>
          }
        >
          <Await resolve={remainingProducts}>
            {(remainingProducts) => {
              const products = [
                ...collection.products.nodes,
                ...remainingProducts,
              ];
              return (
                <>
                  <FiltersToolbar itemCount={products.length} />
                  <CollectionGrid products={products} />
                </>
              );
            }}
          </Await>
        </Suspense>
      )}

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
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
  ) @inContext(country: $country, language: $language) {
    collection(handle: $handle) {
      id
      handle
      title
      description
      image {
        ...ProductImage
      }
      seo {
        title
      }
      products(
        first: $first,
        last: $last,
        before: $startCursor,
        after: $endCursor
        sortKey: $sortKey
        reverse: $reverse
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
