import { Suspense, useRef } from "react";
import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaArgs } from "@remix-run/react";
import { Analytics } from "@shopify/hydrogen";
import { useScrollPercentage } from "~/lib/hooks";

import { getCollectionQuery } from "~/lib/data/collection.server";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";
import { ProductGrid } from "~/components/product-grid";

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
  let ref = useRef<HTMLDivElement>(null);
  let scrollPercentage = useScrollPercentage(ref);

  let translatePercent = Math.round(Math.min(scrollPercentage * 4, 1) * 100);

  return (
    <div>
      <div
        ref={ref}
        className="relative grid h-[200px] place-items-center md:h-[360px] lg:h-[400px] xl:h-[480px] 2xl:h-[540px]"
      >
        <div className="font-title relative isolate w-full text-center text-2xl leading-none font-black tracking-[-0.17em] whitespace-nowrap uppercase select-none md:text-5xl lg:text-7xl">
          <h1 className="relative z-50 bg-black text-white select-text">
            {collection.title}
          </h1>
          <span
            aria-hidden="true"
            className="text-pink-brand absolute inset-0 z-40 bg-black"
            style={{
              transform: `translateY(${translatePercent}%)`,
            }}
          >
            {collection.title}
          </span>

          <span
            aria-hidden="true"
            className="text-red-brand absolute inset-0 bg-black"
            style={{
              transform: `translateY(${2 * translatePercent}%)`,
            }}
          >
            {collection.title}
          </span>
          <span
            aria-hidden="true"
            className="text-yellow-brand absolute inset-0 z-30 bg-black"
            style={{
              transform: `translateY(${-translatePercent}%)`,
            }}
          >
            {collection.title}
          </span>
          <span
            aria-hidden="true"
            className="text-green-brand absolute inset-0 z-20 bg-black"
            style={{
              transform: `translateY(${-2 * translatePercent}%)`,
            }}
          >
            {collection.title}
          </span>
          <span
            aria-hidden="true"
            className="text-blue-brand absolute inset-0 z-10 bg-black"
            style={{
              transform: `translateY(${-3 * translatePercent}%)`,
            }}
          >
            {collection.title}
          </span>
        </div>
      </div>

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
