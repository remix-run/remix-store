import { data, redirect, type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { type MetaArgs, useLoaderData } from "react-router";
import { Analytics } from "@shopify/hydrogen";

import { getCollectionQuery } from "~/lib/data/collection.server";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";
import { ProductGrid } from "~/components/product-grid";
import { PageTitle } from "~/components/page-title";

import ogImageSrc from "~/assets/images/social-collections.jpg";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  if (!data) return generateMeta();

  const { collection } = data;
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: collection.seo?.title || collection.title,
    url: siteUrl,
    image: ogImageSrc,
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

  return data({ collection });
}

export default function Collection() {
  let { collection } = useLoaderData<typeof loader>();

  return (
    <div>
      <PageTitle className="xl:h-[520px] 2xl:h-[600px]">
        {collection.title}
      </PageTitle>

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
