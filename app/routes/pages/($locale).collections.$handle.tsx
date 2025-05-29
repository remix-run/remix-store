import { data } from "react-router";
import { Analytics } from "@shopify/hydrogen";

import { getCollectionQuery } from "~/lib/data/collection.server";
import { getFilterQueryVariables } from "~/lib/filters/query-variables.server";
import { generateMeta } from "~/lib/meta";
import { ProductGrid } from "~/components/product-grid";
import { PageTitle } from "~/components/page-title";

import ogImageSrc from "~/assets/images/social-collections.jpg";
import type { Route } from "./+types/($locale).collections.$handle";

export function meta({ data, matches }: Route.MetaArgs) {
  if (!data) return generateMeta();

  const { collection } = data;
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: collection.seo?.title || collection.title,
    url: siteUrl,
    image: ogImageSrc,
  });
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const { handle } = params;
  const { storefront } = context;

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

export default function Collection({ loaderData }: Route.ComponentProps) {
  let { collection } = loaderData;

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
