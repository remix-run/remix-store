import {
  array,
  boolean,
  nullable,
  number,
  object,
  optional,
  parse,
  string,
} from "remix/data-schema";
import {
  clientEntry,
  css,
  on,
  type Handle,
  type SerializableObject,
} from "remix/ui";

import type {
  ProductCardData,
  ProductPageInfoData,
} from "../../data/storefront.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";
import { ProductGrid } from "./product-grid.tsx";

interface CollectionProductGridProps extends SerializableObject {
  action: string;
  pageInfo: ProductPageInfoData;
  pathPrefix?: MarketPathPrefix;
  products: ProductCardData[];
}

const ProductsPageResponseSchema = object({
  pageInfo: object({
    endCursor: optional(nullable(string())),
    hasNextPage: boolean(),
  }),
  products: array(
    object({
      compareAtPrice: optional(nullable(string())),
      handle: string(),
      id: string(),
      images: array(
        object({
          altText: optional(nullable(string())),
          height: optional(nullable(number())),
          id: optional(nullable(string())),
          url: string(),
          width: optional(nullable(number())),
        }),
      ),
      isOnSale: boolean(),
      price: string(),
      title: string(),
    }),
  ),
});

export const CollectionProductGrid = clientEntry(
  import.meta.url,
  function CollectionProductGrid(handle: Handle<CollectionProductGridProps>) {
    let products = handle.props.products;
    let pageInfo = handle.props.pageInfo;
    let status: "idle" | "loading" | "error" = "idle";

    return () => (
      <section aria-label="Collection products">
        <ProductGrid
          products={products}
          pathPrefix={handle.props.pathPrefix}
          ariaBusy={status === "loading"}
          loadingProductCount={status === "loading" ? 8 : 0}
        />
        {pageInfo.hasNextPage && pageInfo.endCursor ? (
          <form
            action={handle.props.action}
            method="get"
            mix={on("submit", async (event, signal) => {
              event.preventDefault();
              let form = event.currentTarget;
              let url = new URL(form.action, window.location.href);
              let data = new FormData(form);
              for (let [name, value] of data) {
                if (!(value instanceof File)) url.searchParams.set(name, value);
              }

              status = "loading";
              await handle.update();
              try {
                let response = await fetch(url, {
                  headers: { Accept: "application/json" },
                  signal,
                });
                if (!response.ok)
                  throw new Error(`Request failed with ${response.status}`);

                let nextPage = parse(
                  ProductsPageResponseSchema,
                  await response.json(),
                );

                let productsById = new Map(
                  [...products, ...nextPage.products].map((product) => [
                    product.id,
                    product,
                  ]),
                );
                products = [...productsById.values()];
                pageInfo = nextPage.pageInfo;
                status = "idle";
              } catch (error) {
                if (signal.aborted) return;
                console.error(
                  "[collection] Unable to load more products",
                  error,
                );
                status = "error";
              }
              await handle.update();
            })}
          >
            <input type="hidden" name="cursor" value={pageInfo.endCursor} />
            <button
              type="submit"
              disabled={status === "loading"}
              mix={loadMoreStyle}
            >
              {status === "loading" ? "Loading…" : "Load more"}
            </button>
            {status === "error" ? (
              <p role="alert" mix={errorStyle}>
                Products could not be loaded. Please try again.
              </p>
            ) : null}
          </form>
        ) : null}
      </section>
    );
  },
);

const loadMoreStyle = css({
  background: "var(--color-blue-brand)",
  border: 0,
  borderRadius: 0,
  color: "var(--color-white)",
  cursor: "pointer",
  display: "block",
  fontSize: "1.25rem",
  fontWeight: 700,
  lineHeight: 1.4,
  padding: "36px 20px",
  textAlign: "center",
  transition: "background 180ms ease, color 180ms ease",
  width: "100%",
  "&:hover": {
    background: "var(--color-white)",
    color: "var(--color-blue-brand)",
  },
  "&:disabled": {
    background: "rgba(255,255,255,.8)",
    color: "var(--color-blue-brand)",
    cursor: "wait",
  },
});

const errorStyle = css({
  background: "var(--color-red-brand)",
  color: "var(--color-black)",
  fontWeight: 700,
  margin: 0,
  padding: "12px 20px",
  textAlign: "center",
});
