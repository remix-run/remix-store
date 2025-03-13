import { Link } from "@remix-run/react";
import { Image as HydrogenImage, Money } from "@shopify/hydrogen";
import { clsx } from "clsx";

import type {
  ProductImageFragment,
  ProductItemFragment,
} from "storefrontapi.generated";

// TODO:
// - defer product loading
// - add product grid example to the docs
// - add product grid for collection pages
// - remove old, unneeded code
interface ProductGridProps {
  products: ProductItemFragment[];
}

export function ProductGrid({ products }: ProductGridProps) {
  if (!products?.length) return null;

  return (
    <div className="3xl:grid-cols-5 grid grid-cols-1 gap-y-9 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {products.map((product) => (
        <ProductGridItem key={product.id} product={product} />
      ))}
    </div>
  );
}

interface ProductGridItemProps {
  product: ProductItemFragment;
}

function ProductGridItem({ product }: ProductGridItemProps) {
  const { handle, title, variants } = product;

  const { price } = variants.nodes[0];

  return (
    <div className="group relative flex flex-col items-center">
      <ProductImages images={product.images.nodes} />
      <div className="flex flex-col items-center justify-center gap-2.5 py-2 text-base leading-none text-white">
        <Link
          prefetch="intent"
          to={`/products/${handle}`}
          className="font-bold no-underline hover:text-white"
        >
          <span className="absolute inset-0" />
          {title}
        </Link>
        <div className="font-normal">
          <Money className="text-white" data={price} withoutTrailingZeros />
        </div>
      </div>
    </div>
  );
}

interface ProductImagesProps {
  images: ProductImageFragment[];
}

function ProductImages({ images }: ProductImagesProps) {
  let firstImage = images[0];
  let secondImage = images.length > 1 ? images[1] : null;

  let sizes =
    "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";

  let baseCss = "max-h-[90%] object-cover object-center";

  return (
    <div className="relative flex w-[70%] items-center justify-center transition-transform group-hover:scale-105">
      <HydrogenImage
        data={firstImage}
        sizes={sizes}
        className={clsx(
          baseCss,
          secondImage &&
            "relative opacity-100 group-hover:absolute group-hover:opacity-0",
        )}
        loading="lazy"
      />
      {secondImage && (
        <HydrogenImage
          data={secondImage}
          sizes={sizes}
          className={clsx(
            baseCss,
            "absolute opacity-0 group-hover:relative group-hover:opacity-100",
          )}
          loading="lazy"
        />
      )}
    </div>
  );
}
