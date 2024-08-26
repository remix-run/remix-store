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

interface TagProps {
  status: "soldOut" | "onSale" | "new" | "none";
}

const statusText = {
  soldOut: "SOLD OUT",
  onSale: "SALE",
  new: "NEW",
};

const tagStyles = cva("absolute left-6 top-5 text-sm font-bold", {
  variants: {
    status: {
      soldOut: "text-neutral-600 dark:text-neutral-300 opacity-50",
      onSale: "text-red-brand",
      new: "text-neutral-600 dark:text-neutral-300",
    },
  },
});

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
          "grid",
          "grid-cols-[repeat(2,_174px)] gap-3",
          "sm:grid-cols-[repeat(2,_232px)] sm:gap-x-3 sm:gap-y-4",
          "md:grid-cols-[repeat(3,_232px)]",
          "lg:grid-cols-[repeat(3,_320px)] lg:gap-3",
          "xl:grid-cols-[repeat(3,_400px)]",
          "2xl:grid-cols-[repeat(4,_400px)]",
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

        <Tag status={status} />

        <div className="absolute bottom-5 pl-6">
          <h3 className="mb-2 text-xs font-bold tracking-[-0.96px] md:text-2xl">
            {title}
          </h3>
          <small className="flex gap-2 text-xs">
            <Money data={price} withoutTrailingZeros />
            {isOnSale && (
              <Money
                data={compareAtPrice}
                withoutTrailingZeros
                className="line-through opacity-35"
              />
            )}
          </small>
        </div>
      </div>
    </Link>
  );
}

const Tag = ({ status }: TagProps) => {
  if (status === "none") return null;
  return <span className={tagStyles({ status })}>{statusText[status]}</span>;
};
