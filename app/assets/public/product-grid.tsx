import { css, type Handle } from "remix/ui";

import type { ProductCardData } from "../../data/storefront.ts";
import type { MarketPathPrefix } from "../../lib/public/market.ts";
import { ProductCard, ProductCardSkeleton } from "./product-card.tsx";

export function ProductGrid(
  handle: Handle<{
    ariaBusy?: boolean;
    loadingProductCount?: number;
    pathPrefix?: MarketPathPrefix;
    products: ProductCardData[];
  }>,
) {
  return () => (
    <ul aria-busy={handle.props.ariaBusy || undefined} mix={productGridStyle}>
      {handle.props.products.map((product) => (
        <li key={product.id}>
          <ProductCard pathPrefix={handle.props.pathPrefix} product={product} />
        </li>
      ))}
      {Array.from({ length: handle.props.loadingProductCount ?? 0 }).map(
        (_, index) => (
          <li key={`loading-product-${index}`}>
            <ProductCardSkeleton />
          </li>
        ),
      )}
    </ul>
  );
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
