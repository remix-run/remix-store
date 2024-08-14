import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";
import type { RecommendedProductsQuery } from "storefrontapi.generated";
import { Image } from "~/components/image";
import { parseGradientColors } from "~/lib/metafields";
import clsx from "clsx";

interface CollectionGridProps {
  products?: RecommendedProductsQuery["products"]["nodes"];
}

export function CollectionGrid({ products }: CollectionGridProps) {
  if (!products) return null;

  return (
    <div
      className={clsx(
        // Undo padding on the body for full-width grid
        "-mx-3 py-6 sm:-mx-9 sm:py-8",
        "flex justify-center bg-black bg-opacity-5 dark:bg-opacity-20",
      )}
    >
      <div
        // TODO: validate with design these breakpoints/the in-between states. For example, the desktop is at 1440px
        className={clsx(
          "grid gap-3",
          // mobile
          "grid-cols-[repeat(2,_174px)] md:gap-x-3 md:gap-y-4",
          // tablet -- is the gap-y supposed to be 4?
          "md:grid-cols-[repeat(3,_232px)] md:gap-x-3 md:gap-y-4",
          // desktop
          "lg:grid-cols-[repeat(3,_400px)] lg:gap-3",
          // desktop ultrawide
          "xl:grid-cols-[repeat(4,_400px)] xl:gap-3",
        )}
      >
        {products.map((product) => (
          <CollectionItem product={product} key={product.id} />
        ))}
      </div>
    </div>
  );
}

interface CollectionItemProps {
  product: RecommendedProductsQuery["products"]["nodes"][0];
}

export function CollectionItem({ product }: CollectionItemProps) {
  const { handle, title } = product;
  const price = product?.priceRange.minVariantPrice;
  // temporary value, we need to add the logic to the product admin
  const isOnSale = false;
  const gradients = parseGradientColors(product.gradientColors);

  return (
    <Link
      className="hover:text-inherit hover:no-underline"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div
        className={clsx(
          "relative isolate aspect-square w-full overflow-hidden rounded-2xl bg-neutral-100 shadow-yamaha-secondary dark:bg-neutral-700",
        )}
      >
        <Image
          aspectRatio="1/1"
          data={product.images.nodes[0]}
          gradient={gradients[0]}
          gradientHover={true}
          sizes="(min-width: 45em) 20vw, 50vw"
        />
        {isOnSale ? (
          <p className="pl-6 font-bold text-red-brand">SALE</p>
        ) : null}

        <div className="absolute bottom-5 gap-2 pl-6">
          <h3 className="text-xs font-bold tracking-[-0.96px] md:text-2xl">
            {title}
          </h3>
          <small>
            {/* TODO: account for if the product is out of stock -- might not be feasible since we'd have to grab all variants */}
            <Money data={price} />
          </small>
        </div>
      </div>
    </Link>
  );
}
