import { css, Frame, type Handle } from "remix/component";

import { ProductCard } from "../assets/public/product-card.tsx";
import type {
  ProductCardData,
  ProductPageInfoData,
} from "../data/storefront.ts";
import { marketPath, type MarketPathPrefix } from "../lib/public/market.ts";
import { routes } from "../routes.ts";

interface ProductPageProps {
  collectionHandle: string;
  pageInfo: ProductPageInfoData;
  pathPrefix: MarketPathPrefix;
  products: ProductCardData[];
}

/** A collection's first page of cards. Later pages load into nested frames. */
export function CollectionProducts(handle: Handle<ProductPageProps>) {
  return () => (
    <section aria-label="Collection products">
      <ul mix={productGridStyle}>
        <ProductPage {...handle.props} />
      </ul>
    </section>
  );
}

/** Grid items for one page, ending in a frame for the next page's control. */
export function ProductPage(handle: Handle<ProductPageProps>) {
  return () => {
    let { collectionHandle, pageInfo, pathPrefix, products } = handle.props;
    return (
      <>
        {products.map((product) => (
          <li key={product.id}>
            <ProductCard pathPrefix={pathPrefix} product={product} />
          </li>
        ))}
        {pageInfo.hasNextPage && pageInfo.endCursor ? (
          <Frame
            src={collectionPageHref(
              "loadMore",
              collectionHandle,
              pageInfo.endCursor,
              pathPrefix,
            )}
          />
        ) : null}
      </>
    );
  };
}

export function collectionPageHref(
  route: "products" | "loadMore",
  collectionHandle: string,
  cursor: string,
  pathPrefix: MarketPathPrefix,
): string {
  let href = routes.collections[route].href({ handle: collectionHandle });
  return `${marketPath(href, pathPrefix)}?${new URLSearchParams({ cursor })}`;
}

const productGridStyle = css({
  background: "linear-gradient(in oklab, #2d2d38 0%, var(--color-black) 100%)",
  display: "grid",
  gap: "36px 0",
  gridTemplateColumns: "minmax(0, 1fr)",
  listStyle: "none",
  margin: 0,
  padding: 0,
  "& > li": { minWidth: 0 },
  // Production ends the last page with one more row gap before the footer.
  "&:has(> li:last-child > article)": { paddingBottom: "36px" },
  "@media (min-width: 810px)": {
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  },
  "@media (min-width: 1400px)": {
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  },
  "@media (min-width: 2000px)": {
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  },
  "@media (min-width: 2700px)": {
    gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
  },
});
