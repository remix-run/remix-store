import { Link } from "@remix-run/react";
import { Money } from "@shopify/hydrogen";
import type { RecommendedProductsQuery } from "storefrontapi.generated";
import { Image } from "~/components/image";
import { parseGradientColors } from "~/lib/metafields";
import clsx from "clsx";
import { cva } from "class-variance-authority";

interface CollectionGridProps {
  products?: RecommendedProductsQuery["products"]["nodes"];
}

export function CollectionGrid({ products }: CollectionGridProps) {
  if (!products) return null;

  return (
    <div
      // TODO: validate with design these breakpoints/the in-between states. For example, the desktop is at 1440px
      className={clsx(
        "grid grid-cols-2 gap-x-3 gap-y-6",
        "md:grid-cols-3 md:gap-x-[18px] md:gap-y-9",
        "lg:grid-cols-4",
      )}
    >
      {products.map((product) => (
        <CollectionItem product={product} key={product.id} />
      ))}
    </div>
  );
}

interface CollectionItemProps {
  product: RecommendedProductsQuery["products"]["nodes"][0];
}

export function CollectionItem({ product }: CollectionItemProps) {
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
      className="flex flex-col gap-3 no-underline md:gap-[18px]"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div
        className={clsx(
          "relative h-[160px] overflow-hidden rounded-[20px] bg-black bg-opacity-5 sm:h-[240px] md:h-[300px] lg:h-[400px] xl:h-[400px] 2xl:h-[480px] dark:bg-opacity-20",
        )}
      >
        <Image
          data={product.images.nodes[0]}
          gradient={gradients[0]}
          gradientHover={true}
          sizes="(min-width: 45em) 20vw, 50vw"
          className="max-h-full max-w-full overflow-hidden"
        />
        <Tag status={status} />
      </div>
      <h3 className="text-sm font-semibold leading-[1.2rem] tracking-[-0.28px] text-black sm:text-base sm:leading-none sm:tracking-[-0.32px] md:text-xl md:tracking-[-0.4px] lg:text-2xl lg:tracking-[-0.48px] dark:text-white">
        {title}
      </h3>
      <small className="text-dark flex gap-2 font-mono text-xs font-medium leading-none sm:text-base dark:text-white">
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

interface TagProps {
  status: "soldOut" | "onSale" | "new" | "none";
}

const statusText = {
  soldOut: "SOLD OUT",
  onSale: "SALE",
  new: "NEW",
};

const tagStyles = cva(
  "absolute left-4 top-4 md:left-6 md:top-6 p-3 text-sm font-bold rounded-[10px] bg-neutral-200 dark:bg-neutral-800",
  {
    variants: {
      status: {
        soldOut: "text-neutral-600 dark:text-neutral-300",
        onSale: "text-red-brand",
        new: "text-neutral-600 dark:text-neutral-300",
      },
    },
  },
);

const Tag = ({ status }: TagProps) => {
  if (status === "none") return null;
  return <span className={tagStyles({ status })}>{statusText[status]}</span>;
};
