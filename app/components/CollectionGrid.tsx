import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";
import type { RecommendedProductsQuery } from "storefrontapi.generated";
import { Image } from "~/components/Image";
import { parseGradientColors } from "~/lib/metafields";
import clsx from "clsx";

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
      className="contents hover:text-inherit hover:no-underline"
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
          <h3 className="font-body text-2xl font-bold tracking-tight">
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

interface CollectionGridProps {
  products?: RecommendedProductsQuery["products"]["nodes"];
}

export function CollectionGrid({ products }: CollectionGridProps) {
  if (!products) return null;

  return (
    <div
      className={
        "grid grid-cols-2 gap-3 bg-black bg-opacity-5 px-3 py-12 md:px-12 lg:grid-cols-3 2xl:grid-cols-4 dark:bg-opacity-20"
      }
    >
      {products.map((product) => (
        <CollectionItem product={product} key={product.id} />
      ))}
    </div>
  );
}
