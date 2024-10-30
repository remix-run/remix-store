import { Suspense } from "react";
import {
  defer,
  redirect,
  type LoaderFunctionArgs,
} from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaFunction } from "@remix-run/react";
import { Analytics } from "@shopify/hydrogen";
import { CollectionGrid } from "~/components/collection-grid";
import { Hero } from "~/components/hero";
import { FiltersAside, FiltersToolbar } from "~/components/filters";

import { COLLECTION_QUERY } from "~/lib/queries";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = `The Remix Store`;

  if (data?.collection.seo?.title) {
    title += ` | ${data.collection.seo.title}`;
  } else if (data?.collection.title) {
    title += ` | ${data.collection.title} Collection`;
  }

  return [{ title }];
};

export async function loader({ params, request, context }: LoaderFunctionArgs) {
  const { handle } = params;
  const { storefront } = context;

  if (!handle) {
    throw redirect("/collections");
  }

  const url = new URL(request.url);
  const { searchParams } = url;
  const variables = { handle, ...getFilterQueryVariables(searchParams) };

  // load the initial products we want to SSR
  const { collection } = await storefront.query(COLLECTION_QUERY, {
    variables: {
      ...variables,
      first: 8,
    },
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

      <FiltersAside>
        {!remainingProducts ? (
          <>
            <FiltersToolbar itemCount={collection.products.nodes.length} />
            <CollectionGrid products={collection.products.nodes} />
          </>
        ) : (
          <Suspense
            fallback={
              <>
                <FiltersToolbar />
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
      </FiltersAside>

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
