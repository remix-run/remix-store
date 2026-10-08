import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";

import { LoadMoreProducts } from "../../assets/public/load-more-products.tsx";
import { queryCollection } from "../../data/storefront.ts";
import { marketPath, type MarketPathPrefix } from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import {
  collectionPageHref,
  ProductPage,
} from "../../ui/collection-products.tsx";
import { NotFoundPage } from "../pages.tsx";
import { CollectionPage } from "./page.tsx";

const MAX_CURSOR_LENGTH = 2_048;
const FIRST_PAGE_SIZE = 15;
const NEXT_PAGE_SIZE = 8;
// Grid fragments are frame content, not documents to index.
const FRAGMENT_HEADERS = { "X-Robots-Tag": "noindex" };

export default createController(routes.collections, {
  actions: {
    index({ market }) {
      return redirect(
        marketPath(
          routes.collections.show.href({ handle: "all" }),
          market.pathPrefix,
        ),
      );
    },
    async show({ market, params, render, storefrontClient, url }) {
      let cursor = readCursor(url);
      if (cursor instanceof Response) return cursor;

      // A cursor here is the "Load more" fallback without JavaScript.
      let collection = await queryCollection(storefrontClient, params.handle, {
        after: cursor,
        first: cursor ? NEXT_PAGE_SIZE : FIRST_PAGE_SIZE,
      });
      if (!collection.ok) {
        throw new Error(collection.message, { cause: collection.errors });
      }
      if (!collection.data) {
        return render(<NotFoundPage />, { status: 404 });
      }

      return render(
        <CollectionPage
          canonicalUrl={
            url.origin +
            marketPath(routes.collections.show.href(params), market.pathPrefix)
          }
          market={market}
          id={collection.data.id}
          handle={collection.data.handle}
          title={collection.data.title}
          seoTitle={collection.data.seoTitle}
          description={collection.data.description}
          products={collection.data.products.nodes}
          pageInfo={collection.data.products.pageInfo}
        />,
      );
    },
    async products({ market, params, render, request, storefrontClient, url }) {
      let cursor = readCursor(url);
      if (cursor instanceof Response) return cursor;
      if (!cursor) return new Response("Missing cursor", { status: 400 });

      let collection;
      try {
        collection = await queryCollection(storefrontClient, params.handle, {
          after: cursor,
          first: NEXT_PAGE_SIZE,
        });
      } catch (error) {
        if (request.signal.aborted) throw error;
        console.error("[collection] Unable to load a product page", error);
      }
      if (!collection?.ok) {
        return render(
          loadMoreControl(params.handle, cursor, market.pathPrefix, true),
          { headers: FRAGMENT_HEADERS },
        );
      }
      if (!collection.data) {
        return render(null, { status: 404, headers: FRAGMENT_HEADERS });
      }

      return render(
        <ProductPage
          collectionHandle={params.handle}
          pageInfo={collection.data.products.pageInfo}
          pathPrefix={market.pathPrefix}
          products={collection.data.products.nodes}
        />,
        { headers: FRAGMENT_HEADERS },
      );
    },
    loadMore({ market, params, render, url }) {
      let cursor = readCursor(url);
      if (cursor instanceof Response) return cursor;
      if (!cursor) return new Response("Missing cursor", { status: 400 });

      return render(loadMoreControl(params.handle, cursor, market.pathPrefix), {
        headers: FRAGMENT_HEADERS,
      });
    },
  },
});

function loadMoreControl(
  collectionHandle: string,
  cursor: string,
  pathPrefix: MarketPathPrefix,
  failed = false,
) {
  return (
    <LoadMoreProducts
      action={marketPath(
        routes.collections.show.href({ handle: collectionHandle }),
        pathPrefix,
      )}
      cursor={cursor}
      failed={failed}
      src={collectionPageHref("products", collectionHandle, cursor, pathPrefix)}
    />
  );
}

function readCursor(url: URL): string | undefined | Response {
  let cursor = url.searchParams.get("cursor")?.trim() || undefined;
  if (cursor && cursor.length > MAX_CURSOR_LENGTH) {
    return new Response("Invalid cursor", { status: 400 });
  }
  return cursor;
}
