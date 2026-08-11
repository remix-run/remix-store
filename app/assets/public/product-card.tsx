import { css, type Handle } from "remix/ui";

import type { ProductCardData } from "../../data/storefront.ts";
import { ShopifyImage } from "../../ui/public/shopify-image.tsx";

const PRODUCT_IMAGE_SIZES =
  "(min-width: 2700px) 14vw, (min-width: 2000px) 17.5vw, (min-width: 1400px) 23.33vw, (min-width: 810px) 35vw, 70vw";

export function ProductCard(handle: Handle<{ product: ProductCardData }>) {
  return () => {
    let product = handle.props.product;
    let [firstImage, secondImage] = product.images;

    return (
      <article mix={cardStyle}>
        <a
          href={`/products/${encodeURIComponent(product.handle)}`}
          mix={linkStyle}
        >
          <div
            aria-hidden={firstImage ? undefined : "true"}
            mix={imageRegionStyle}
          >
            {firstImage ? (
              <ShopifyImage
                image={firstImage}
                alt=""
                sizes={PRODUCT_IMAGE_SIZES}
              />
            ) : (
              <div mix={placeholderStyle} />
            )}
            {secondImage ? (
              <ShopifyImage
                image={secondImage}
                alt=""
                sizes={PRODUCT_IMAGE_SIZES}
              />
            ) : null}
          </div>
          <div mix={textStyle}>
            <h3>{product.title}</h3>
            <ProductPrice
              price={product.price}
              compareAtPrice={product.compareAtPrice}
              isOnSale={product.isOnSale}
            />
          </div>
        </a>
      </article>
    );
  };
}

export function ProductCardSkeleton() {
  return () => (
    <article aria-hidden="true" mix={cardStyle}>
      <div mix={skeletonLayoutStyle}>
        <div mix={imageRegionStyle}>
          <div mix={skeletonImageStyle} />
        </div>
        <div mix={skeletonTextStyle} />
      </div>
    </article>
  );
}

function ProductPrice(
  handle: Handle<{
    compareAtPrice?: string | null;
    isOnSale: boolean;
    price: string;
  }>,
) {
  return () => {
    let { compareAtPrice, isOnSale, price } = handle.props;
    return isOnSale && compareAtPrice ? (
      <p mix={salePriceStyle}>
        <s>{compareAtPrice}</s>
        <span>{price}</span>
      </p>
    ) : (
      <p mix={priceStyle}>{price}</p>
    );
  };
}

const cardStyle = css({ minWidth: 0, position: "relative" });
const linkStyle = css({
  alignItems: "center",
  color: "var(--color-white)",
  display: "flex",
  flexDirection: "column",
  height: "100%",
  outlineOffset: "-4px",
  textDecoration: "none",
  "&:hover": { color: "var(--color-white)" },
  "& > div:first-child > img + img": { opacity: 0 },
  "&:hover > div:first-child": {
    animation: "product-image-bounce 520ms var(--ease-snap)",
  },
  "&:hover > div:first-child > img:first-child:not(:last-child)": {
    opacity: 0,
  },
  "&:hover > div:first-child > img:last-child:not(:first-child)": {
    opacity: 1,
  },
});
const imageRegionStyle = css({
  alignItems: "center",
  aspectRatio: "1 / 1",
  display: "flex",
  justifyContent: "center",
  position: "relative",
  width: "70%",
  "& img": {
    height: "auto",
    maxHeight: "90%",
    maxWidth: "90%",
    objectFit: "contain",
    position: "relative",
    width: "100%",
  },
  "& img + img": {
    inset: "5%",
    height: "90%",
    position: "absolute",
    width: "90%",
  },
});
const placeholderStyle = css({
  aspectRatio: "1 / 1",
  background:
    "radial-gradient(circle, rgba(255,255,255,.12) 0%, rgba(255,255,255,.025) 55%, transparent 75%)",
  borderRadius: "50%",
  width: "90%",
});
const textStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  justifyContent: "center",
  minHeight: "64px",
  padding: "0 12px",
  textAlign: "center",
  "& h3": { fontSize: "1rem", fontWeight: 700, lineHeight: 1, margin: 0 },
});
const skeletonLayoutStyle = css({
  alignItems: "center",
  display: "flex",
  flexDirection: "column",
});
const skeletonImageStyle = css({
  animation: "product-skeleton-pulse 1800ms ease-in-out infinite alternate",
  aspectRatio: "1 / 1",
  background:
    "radial-gradient(circle, rgba(255,255,255,.12), rgba(0,0,0,.1) 70%)",
  borderRadius: "50%",
  filter: "blur(16px)",
  width: "90%",
});
const skeletonTextStyle = css({ height: "64px" });
const priceStyle = css({ lineHeight: 1, margin: 0 });
const salePriceStyle = css({
  display: "flex",
  gap: "6px",
  lineHeight: 1,
  margin: 0,
  "& span": { color: "var(--color-red-brand)", fontWeight: 700 },
});
