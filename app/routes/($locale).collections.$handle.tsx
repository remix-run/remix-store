import { Suspense } from "react";
import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { Await, useLoaderData, type MetaArgs } from "@remix-run/react";
import { Analytics, Image as HydrogenImage } from "@shopify/hydrogen";
import { FiltersAside, FiltersToolbar } from "~/components/filters";
import { AsciiImage } from "~/components/ascii-image";

import { getCollectionQuery } from "~/lib/collection.server";
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
  const { collection, remainingProducts } = useLoaderData<typeof loader>();

  const { image } = collection;

  return (
    <div>
      <div className="relative h-[280px] w-full overflow-hidden xl:h-[400px] 2xl:h-[540px]">
        {image && (
          <AsciiImage
            data={image}
            className=""
            asciiDensity={0.3}
            characters={["█", "▓", "▒", "░", " "]}
            style={{
              backgroundColor: "#000",
            }}
          />
        )}
        <h1 className="absolute inset-0 z-10 flex items-center justify-center text-3xl font-semibold text-white md:text-[56px] lg:text-8xl">
          {collection.title}
        </h1>
      </div>
      <FiltersAside>
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
                if (!remainingProducts) {
                  return null;
                }

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
