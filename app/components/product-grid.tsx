import { Link } from "@remix-run/react";
import { Image, Money } from "@shopify/hydrogen";
import type { ProductItemFragment } from "storefrontapi.generated";

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
      <div className="flex w-[70%] items-center justify-center">
        <Image
          data={product.images.nodes[0]}
          sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
          className="max-h-[90%] object-cover object-center transition-transform group-hover:scale-105"
          loading="lazy"
        />
      </div>
      <div className="flex flex-col items-center justify-center gap-2.5 py-2 text-base leading-none text-white">
        <Link
          prefetch="intent"
          to={`/products/${handle}`}
          className="font-bold no-underline hover:text-white"
        >
          {/* <span className="absolute inset-0" /> */}
          {title}
        </Link>
        <div className="font-normal">
          <Money className="text-white" data={price} withoutTrailingZeros />
        </div>
      </div>
    </div>
  );
}
