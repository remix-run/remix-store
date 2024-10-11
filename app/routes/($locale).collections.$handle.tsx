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

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = `The Remix Store`;

  if (data?.collection.seo?.title) {
    title += ` | ${data.collection.seo.title}`;
  } else if (data?.collection.title) {
    title += ` | ${data.collection.title} Collection`;
  }

  return [{ title }];
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function loader({ context, params }: LoaderFunctionArgs) {
  const { handle } = params;
  const { storefront } = context;

  if (!handle) {
    throw redirect("/collections");
  }

  // load the initial products we want to SSR
  const { collection } = await storefront.query(COLLECTION_QUERY, {
    variables: { handle, first: 8 },
    // Add other queries here, so that they are loaded in parallel
  });

  if (!collection) {
    throw new Response("Collection not found", {
      status: 404,
    });
  }
  const { hasNextPage, endCursor } = collection.products.pageInfo;

  // lazy load the remaing products if any
  if (hasNextPage) {
    const remainingProducts = storefront
      .query(COLLECTION_QUERY, {
        // if we ever have more than 258 products, we need to figure out a
        // different strategy. Honestly, before that point we'll need to
        // paginate, but loading all is fine for now
        variables: { handle, endCursor, first: 250 },
        // Add other queries here, so that they are loaded in parallel
      })
      .then(async (result) => {
        await sleep(2000);
        return result;
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
      <FiltersToolbar />

      {!remainingProducts ? (
        <CollectionGrid products={collection.products.nodes} />
      ) : (
        <Suspense
          fallback={
            <CollectionGrid
              products={collection.products.nodes}
              loadingCount={4}
            />
          }
        >
          <Await resolve={remainingProducts}>
            {(remainingProducts) => {
              const products = [
                ...collection.products.nodes,
                ...remainingProducts,
              ];
              return <CollectionGrid products={products} />;
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
