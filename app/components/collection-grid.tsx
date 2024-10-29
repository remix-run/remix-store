import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";
import type { ProductItemFragment } from "storefrontapi.generated";
import { Image } from "~/components/ui/image";
import { parseGradientColors } from "~/lib/metafields";
import { cva } from "class-variance-authority";
import clsx from "clsx";

interface CollectionGridProps {
  products?: ProductItemFragment[];
  loadingProductCount?: number;
}

export function CollectionGrid({
  products,
  loadingProductCount: loadingCount,
}: CollectionGridProps) {
  if (!products) return null;

  return (
    <div className="sm grid grid-cols-2 gap-x-3 gap-y-6 md:grid-cols-3 md:gap-x-[18px] md:gap-y-9 lg:grid-cols-4">
      {products.map((product) => (
        <CollectionItem product={product} key={product.id} />
      ))}
      {loadingCount
        ? [...Array(loadingCount)].map((_, index) => (
            // eslint-disable-next-line react/no-array-index-key -- chill, it's fine
            <CollectionItemSkeleton key={index} />
          ))
        : null}
    </div>
  );
}

interface CollectionItemProps {
  product: ProductItemFragment;
}

function CollectionItem({ product }: CollectionItemProps) {
  const { handle, title, variants, availableForSale, tags } = product;

  const firstVariant = variants.nodes[0];
  const price = firstVariant.price;
  const compareAtPrice = firstVariant.compareAtPrice;

  const isOnSale = !!(compareAtPrice && price.amount < compareAtPrice.amount);

  let status: TagProps["status"] = "none";
  if (!availableForSale) {
    status = "soldOut";
  } else if (isOnSale) {
    status = "onSale";
  } else if (tags.some((tag) => tag.toLowerCase() === "new")) {
    status = "new";
  }

  const gradients = parseGradientColors(product.gradientColors);

  return (
    <Link
      className="flex flex-col gap-1 no-underline"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div className="relative h-[160px] overflow-hidden rounded-[20px] bg-black bg-opacity-5 md:h-[240px] lg:h-[300px] xl:h-[400px] 2xl:h-[480px] dark:bg-opacity-20">
        <Image
          data={product.images.nodes[0]}
          gradient={gradients[0] ?? "random"}
          gradientHover={true}
          sizes="(min-width: 1200px) 25vw, (min-width: 800px) 33vw, 50vw"
          className={clsx(
            "max-h-full max-w-full overflow-hidden",
            status === "soldOut" && "opacity-30",
          )}
          loading="lazy"
        />
        <Tag status={status} />
      </div>
      <h3 className="text-sm font-semibold leading-[1.2rem] tracking-[-0.28px] text-black sm:text-base sm:leading-none sm:tracking-[-0.32px] md:text-xl md:tracking-[-0.4px] lg:text-2xl lg:tracking-[-0.48px] dark:text-white">
        {title}
      </h3>
      <small className="text-dark flex gap-2 font-mono text-xs font-medium leading-none sm:text-base sm:leading-none dark:text-white">
        <Money data={price} withoutTrailingZeros />
        {isOnSale && (
          <Money
            data={compareAtPrice}
            withoutTrailingZeros
            className="text-neutral-600 text-opacity-35 line-through dark:text-neutral-300 dark:text-opacity-35"
          />
        )}
      </small>
    </Link>
  );
}

function CollectionItemSkeleton() {
  return (
    <div className="flex flex-col gap-1 no-underline">
      <div className="relative h-[160px] overflow-hidden rounded-[20px] bg-black bg-opacity-5 md:h-[240px] lg:h-[300px] xl:h-[400px] 2xl:h-[480px] dark:bg-opacity-20" />
      <h3 className="text-sm font-semibold leading-[1.2rem] tracking-[-0.28px] text-black sm:text-base sm:leading-none sm:tracking-[-0.32px] md:text-xl md:tracking-[-0.4px] lg:text-2xl lg:tracking-[-0.48px] dark:text-white">
        loading...
      </h3>
    </div>
  );
}

interface TagProps {
  status: "soldOut" | "onSale" | "new" | "none";
}

const statusText = {
  soldOut: "sold out",
  onSale: "sale",
  new: "new",
};

const tagStyles = cva(
  "absolute text-[0.625rem] left-2 top-2 md:left-4 md:top-4 p-2 md:p-3 md:text-base font-bold rounded-[10px] bg-neutral-200 dark:bg-neutral-800 uppercase",
  {
    variants: {
      status: {
        soldOut: "text-neutral-600 dark:text-neutral-300",
        onSale: "text-red-brand",
        new: "text-blue-brand ",
      },
    },
  },
);

const Tag = ({ status }: TagProps) => {
  if (status === "none") return null;
  return <span className={tagStyles({ status })}>{statusText[status]}</span>;
};
