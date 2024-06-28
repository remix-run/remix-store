import {Link} from '@remix-run/react';
import {Money} from '@shopify/hydrogen';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';
import {Image} from '~/components/Image';
import {parseGradientColors} from '~/lib/metafields';

export type ProductType = RecommendedProductsQuery['products']['nodes'][0] & {
  featuredImage?: RecommendedProductsQuery['products']['nodes'][0]['images']['nodes'][0];
};
interface CollectionItemProps {
  product: ProductType;
  isFeatured?: boolean;
}

export function CollectionItem({
  product,
  isFeatured = false,
}: CollectionItemProps) {
  const {handle, title} = product;
  const price = product?.priceRange.minVariantPrice;
  // temporary value, we need to add the logic to the product admin
  const isOnSale = false;
  const gradients = parseGradientColors(product.gradientColors);
  const image = isFeatured ? product?.featuredImage : product?.images.nodes[0];

  return (
    <Link
      className="hover:no-underline"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div className="rounded-2xl bg-neutral-100 dark:bg-neutral-800 card-shadow-light dark:card-shadow-dark relative overflow-hidden aspect-ratio isolate  max-w-[445px] max-h-[445px]">
        <Image
          aspectRatio="1/1"
          data={image}
          gradient={gradients[0]}
          gradientHover={true}
          sizes="(min-width: 45em) 20vw, 50vw"
        />
        {isOnSale ? (
          <p className="pl-6 font-bold text-red-brand">SALE</p>
        ) : null}

        <div className="pl-6 gap-2 absolute bottom-5">
          <h3 className="text-2xl font-bold">{title}</h3>
          <small>
            <Money data={price} />
          </small>
        </div>
      </div>
    </Link>
  );
}

interface ColllectionGridProps {
  productNodes?: ProductType[];
}

export function CollectionGrid({productNodes}: ColllectionGridProps) {
  if (!productNodes) return null;

  return (
    <div className="py-12 px-3 md:px-12 grid gap-3 justify-center grid-flow-colbg-neutral-200 dark:bg-neutral-800 grid-cols-collection-grid">
      {productNodes.map((product) => (
        <CollectionItem
          product={product}
          key={product.id}
          isFeatured={product?.featuredImage?.id ? true : false}
        />
      ))}
    </div>
  );
}
