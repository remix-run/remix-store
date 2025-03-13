import { Await, Link } from "@remix-run/react";
import { Image as HydrogenImage, Money } from "@shopify/hydrogen";
import { clsx } from "clsx";
import { Suspense } from "react";

import type {
  ProductImageFragment,
  ProductItemFragment,
} from "storefrontapi.generated";

// TODO:

// - add product grid example to the docs
// - add product grid for collection pages
// - remove old, unneeded code
let defaultExpectedNumberOfProducts = 8;

type ProductGridProps = {
  products: ProductItemFragment[] | Promise<ProductItemFragment[]>;
  // Defaults to 8, only useful if you're using deferred product data and triggering a skeleton
  expectedNumberOfProducts?: number;
};

export function ProductGrid({
  products,
  expectedNumberOfProducts = defaultExpectedNumberOfProducts,
}: ProductGridProps) {
  return (
    <div className="3xl:grid-cols-5 grid grid-cols-1 gap-y-9 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
      {products instanceof Promise ? (
        <Suspense
          fallback={
            <ProductGridSkeleton
              expectedNumberOfProducts={expectedNumberOfProducts}
            />
          }
        >
          <Await
            resolve={products}
            errorElement={
              // Should probably let the user know something went wrong loading the images
              <div className="h-[1000px]" />
            }
          >
            {(products) =>
              products.map((product) => (
                <ProductGridItem key={product.id} product={product} />
              ))
            }
          </Await>
        </Suspense>
      ) : (
        products.map((product) => (
          <ProductGridItem key={product.id} product={product} />
        ))
      )}
    </div>
  );
}

function ProductGridSkeleton({
  expectedNumberOfProducts = defaultExpectedNumberOfProducts,
}: Pick<ProductGridProps, "expectedNumberOfProducts">) {
  return Array.from({ length: expectedNumberOfProducts }).map((_, index) => (
    // eslint-disable-next-line react/no-array-index-key -- all good, just a placeholder
    <ProductGridItemLayout key={index}>
      <ImageLayout>
        <div
          // TODO: revisit this, it's probably too subtle
          className="animate-pulse-radial aspect-square w-full rounded-full bg-radial from-white/10 to-black/10 bg-center bg-no-repeat blur-lg"
        />
      </ImageLayout>
      {/* Empty div to maintain spacing/layout where text will be */}
      <div className="h-14" />
    </ProductGridItemLayout>
  ));
}

type ProductGridItemProps = {
  product: ProductItemFragment;
};

function ProductGridItem({ product }: ProductGridItemProps) {
  let { handle, title, variants } = product;

  let { price } = variants.nodes[0];

  return (
    <ProductGridItemLayout className="group">
      <ProductImages images={product.images.nodes} />
      <div className="flex h-14 flex-col items-center justify-center gap-2.5 text-base leading-none text-white">
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
    </ProductGridItemLayout>
  );
}

type ProductImagesProps = {
  images: ProductImageFragment[];
};

function ProductImages({ images }: ProductImagesProps) {
  let firstImage = images[0];
  let secondImage = images.length > 1 ? images[1] : null;

  let sizes =
    "(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw";

  let baseCss = "max-h-[90%] object-cover object-center";

  return (
    <ImageLayout className="group-hover:scale-105">
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
    </ImageLayout>
  );
}

type LayoutProps = {
  children: React.ReactNode;
  className?: string;
};

function ProductGridItemLayout({ children, className }: LayoutProps) {
  return (
    <div className={clsx("relative flex flex-col items-center", className)}>
      {children}
    </div>
  );
}

function ImageLayout({ children, className }: LayoutProps) {
  return (
    <div
      className={clsx(
        "relative flex w-[70%] items-center justify-center transition-transform group-hover:scale-105",
        className,
      )}
    >
      {children}
    </div>
  );
}
