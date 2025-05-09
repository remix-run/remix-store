import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { type MetaArgs, useLoaderData } from "react-router";
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

  const collection = await getCollectionQuery(storefront, {
    variables: {
      ...variables,
      first: 15,
    },
  });

  if (!collection) {
    throw new Response("Collection not found", {
      status: 404,
    });
  }

  return data({ collection });
}

export default function Collection() {
  let { collection } = useLoaderData<typeof loader>();

  return (
    <div>
      <PageTitle>{collection.title}</PageTitle>

      <ProductGrid
        key={collection.handle}
        products={collection.products}
        loadMoreProducts={{
          numberOfProducts: 8,
          collectionHandle: collection.handle,
          endCursor: collection.productsPageInfo.endCursor ?? undefined,
          hasNextPage: collection.productsPageInfo.hasNextPage,
        }}
      />

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
