import { Link } from "@remix-run/react";
import { Image as HydrogenImage, Money } from "@shopify/hydrogen";
import type { ProductItemFragment } from "storefrontapi.generated";
import { useState, useEffect } from "react";
import { clsx } from "clsx";

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
  const { handle, title, variants, availableForSale, tags } = product;

  const firstVariant = variants.nodes[0];
  const price = firstVariant.price;
  const compareAtPrice = firstVariant.compareAtPrice;

  const isOnSale = !!(compareAtPrice && price.amount < compareAtPrice.amount);

  let status = "none";
  if (!availableForSale) {
    status = "soldOut";
  } else if (isOnSale) {
    status = "onSale";
  } else if (tags.some((tag) => tag.toLowerCase() === "new")) {
    status = "new";
  }

  return (
    <div className="group relative flex flex-col items-center">
      <ProductImages
        images={product.images.nodes}
        sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
      />
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

type LoadingState = "idle" | "pending" | "loaded" | "error";

interface ProductImagesProps {
  images: ProductItemFragment["images"]["nodes"];
  sizes: string;
}

function ProductImages({ images, sizes }: ProductImagesProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoverImageLoaded, setHoverImageLoaded] =
    useState<LoadingState>("idle");

  const firstImage = images[0];
  const secondImage = images.length > 1 ? images[1] : null;

  // Preload second image if it exists
  useEffect(() => {
    if (hoverImageLoaded !== "idle" || !secondImage) return;

    setHoverImageLoaded("pending");

    const img = new Image();
    img.addEventListener("load", () => setHoverImageLoaded("loaded"), {
      once: true,
    });
    img.addEventListener("error", () => setHoverImageLoaded("error"), {
      once: true,
    });
    img.src = secondImage.url;
  }, [secondImage, hoverImageLoaded]);

  return (
    <div className="relative flex w-[70%] items-center justify-center transition-transform group-hover:scale-105">
      <HydrogenImage
        data={firstImage}
        sizes={sizes}
        className={clsx(
          "relative max-h-[90%] object-cover object-center opacity-100",
          hoverImageLoaded === "loaded" &&
            "group-hover:absolute group-hover:opacity-0",
        )}
        loading={hoverImageLoaded !== "loaded" ? "lazy" : "eager"}
      />
      {secondImage && hoverImageLoaded === "loaded" && (
        <HydrogenImage
          data={secondImage}
          sizes={sizes}
          className={clsx(
            "absolute max-h-[90%] object-cover object-center opacity-0 group-hover:relative group-hover:opacity-100",
          )}
        />
      )}
    </div>
  );
}
