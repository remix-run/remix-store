import { Suspense } from "react";
import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaArgs } from "@remix-run/react";
import { Analytics } from "@shopify/hydrogen";

import { getCollectionQuery } from "~/lib/data/collection.server";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";
import { ProductGrid } from "~/components/product-grid";
import { PageTitle } from "~/components/page-title";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  if (!data) return generateMeta();

  const { collection } = data;
  const { siteUrl } = matches[0].data;

  let title = "The Remix Store";

  if (collection.seo?.title) {
    title += ` | ${collection.seo.title}`;
  } else if (collection.title) {
    title += ` | ${collection.title} Collection`;
  }

  return generateMeta({
    title,
    url: siteUrl,
  });
}

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
  const collection = await getCollectionQuery(storefront, {
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

  const { hasNextPage, endCursor } = collection.productsPageInfo;

  // lazy load the remaining products if any
  if (hasNextPage) {
    let remainingProducts = getCollectionQuery(storefront, {
      variables: {
        ...variables,
        endCursor,
        first: 250,
      },
    });

    return data({ collection, remainingProducts });
  }

  return data({ collection, remainingProducts: null });
}

export default function Collection() {
  let { collection, remainingProducts } = useLoaderData<typeof loader>();

  return (
    <div>
      <PageTitle>{collection.title}</PageTitle>

      {remainingProducts ? (
        <Suspense
          fallback={
            <ProductGrid
              products={collection.products}
              loadingProductCount={4}
            />
          }
        >
          <Await resolve={remainingProducts}>
            {(remainingProducts) => {
              const products = [
                ...collection.products,
                ...remainingProducts.products,
              ];
              return <ProductGrid products={products} />;
            }}
          </Await>
        </Suspense>
      ) : (
        <ProductGrid products={collection.products} />
      )}

      {/* <FiltersAside>
        {remainingProducts ? (
          <Suspense
            fallback={
              <>
                <FiltersToolbar />
                <ProductGrid
                  products={collection.products}
                  loadingProductCount={4}
                />
              </>
            }
          >
            <Await resolve={remainingProducts}>
              {(remainingProducts) => {
                const products = [
                  ...collection.products,
                  ...remainingProducts.products,
                ];
                return (
                  <>
                    <FiltersToolbar itemCount={products.length} />
                    <ProductGrid products={products} />
                  </>
                );
              }}
            </Await>
          </Suspense>
        ) : (
          <>
            <FiltersToolbar itemCount={collection.products.length} />
            <ProductGrid products={collection.products} />
          </>
        )}
      </FiltersAside> */}

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
