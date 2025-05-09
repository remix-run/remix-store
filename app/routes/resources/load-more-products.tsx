import type { LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { useFetcher } from "react-router";
import {
  getCollectionQuery,
  type CollectionProductData,
} from "~/lib/data/collection.server";
import { useState, useEffect, useCallback } from "react";
import type { FormProps } from "react-router";

export async function loader({ request, context }: LoaderFunctionArgs) {
  let url = new URL(request.url);
  let searchParams = new URLSearchParams(url.search);

  let numberOfProducts = Number(searchParams.get("numberOfProducts"));
  let endCursor = searchParams.get("endCursor")?.toString();
  let collectionHandle = searchParams.get("collectionHandle")?.toString();

  let { storefront } = context;

  if (!collectionHandle) {
    throw new Response("Collection handle is required", { status: 400 });
  }

  if (!numberOfProducts || isNaN(numberOfProducts)) {
    throw new Response("Number of products is required and must be a number", {
      status: 400,
    });
  }

  let { products, productsPageInfo } = await getCollectionQuery(storefront, {
    variables: {
      handle: collectionHandle,
      first: numberOfProducts,
      endCursor,
    },
  });

  return { products, productsPageInfo };
}

export type LoadMoreProductsOptions = {
  initialProducts: CollectionProductData[];
  numberOfProducts: number;
  collectionHandle: string;
  endCursor?: string;
  hasNextPage: boolean;
};

// RSC would be nice right about now

/**
 * This hook is used to load more products from the collection.
 * It's used in the ProductGrid component to load more products when the user scrolls to the bottom of the grid.
 * It doesn't persist the products as a search param or anything, but for the number of products we have this is probably fine.
 */
export function useLoadMoreProducts({
  numberOfProducts,
  endCursor: initialEndCursor,
  collectionHandle,
  initialProducts,
  hasNextPage: initialHasNextPage,
}: LoadMoreProductsOptions) {
  let fetcher = useFetcher<typeof loader>();
  let [state, setState] = useState({
    products: initialProducts,
    hasNextPage: initialHasNextPage,
    endCursor: initialEndCursor,
  });

  let { Form: FetcherForm, data, ...restOfFetcher } = fetcher;

  // Update products and hasNextPage when new data arrives
  useEffect(() => {
    if (data?.products) {
      setState((prev) => {
        // Create a Map of all products by ID, with newer products overwriting older ones
        let productsMap = new Map(
          [...prev.products, ...data.products].map((product) => [
            product.id,
            product,
          ]),
        );

        return {
          products: Array.from(productsMap.values()),
          hasNextPage: data.productsPageInfo.hasNextPage,
          endCursor: data.productsPageInfo.endCursor ?? undefined,
        };
      });
    }
  }, [data]);

  let { hasNextPage, endCursor } = state;
  let isLoading = fetcher.state !== "idle";

  let Form = useCallback(
    ({ children, ...props }: Omit<FormProps, "method" | "action">) => {
      if (!hasNextPage) {
        return null;
      }

      return (
        <FetcherForm
          method="get"
          action="/_resources/load-more-products"
          {...props}
        >
          <input
            type="hidden"
            name="numberOfProducts"
            value={numberOfProducts}
          />
          <input
            type="hidden"
            name="collectionHandle"
            value={collectionHandle}
          />
          {endCursor && (
            <input type="hidden" name="endCursor" value={endCursor} />
          )}
          <button
            className="bg-blue-brand hover:text-blue-brand disabled:text-blue-brand w-full py-9 text-center text-xl font-bold text-white transition-colors hover:bg-white disabled:bg-white/80"
            type="submit"
            disabled={isLoading}
          >
            <span>{isLoading ? "Loading..." : "Load more"}</span>
          </button>
          {children}
        </FetcherForm>
      );
    },
    [
      hasNextPage,
      FetcherForm,
      numberOfProducts,
      collectionHandle,
      endCursor,
      isLoading,
    ],
  );

  return {
    Form,
    products: state.products,
    ...restOfFetcher,
  };
}
