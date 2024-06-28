import {Link} from '@remix-run/react';
import {Money} from '@shopify/hydrogen';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';
import {Image} from '~/components/Image';
import {parseGradientColors} from '~/lib/metafields';
import clsx from 'clsx';
import {cn} from '~/lib';

interface CollectionItemProps {
  product: RecommendedProductsQuery['products']['nodes'][0];
  index: number;
}

const getColStartClass = (index: number) => {
  const colStartMap = [
    '2xl:col-start-2',
    '2xl:col-start-3',
    '2xl:col-start-1',
    '2xl:col-start-4',
  ];
  return colStartMap[index % colStartMap.length];
};

const getRowStartClass = (index: number) => {
  const rowStart = Math.floor(index / 4) + 1;
  return `2xl:row-start-${rowStart}`;
};

export function CollectionItem({product, index}: CollectionItemProps) {
  const {handle, title} = product;
  const price = product?.priceRange.minVariantPrice;
  // temporary value, we need to add the logic to the product admin
  const isOnSale = false;
  const gradients = parseGradientColors(product.gradientColors);

  return (
    <Link
      className="hover:no-underline contents"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div
        className={clsx(
          'rounded-2xl bg-card-light dark:bg-card-dark card-shadow-light dark:card-shadow-dark relative overflow-hidden aspect-square isolate w-full',
          getColStartClass(index),
          getRowStartClass(index),
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
  className?: string;
  products?: RecommendedProductsQuery['products']['nodes'];
}

export function CollectionGrid({products, className}: ColllectionGridProps) {
  if (!products) return null;

  return (
    <div
      className={cn(
        'py-12 px-3 md:px-12 grid gap-3 md:grid-cols-2 lg:grid-cols-collection-desktop-grid 2xl:grid-cols-collection-desktop-grid-max-4 2xl:place-content-center  bg-gridContainer-light dark:bg-gridContainer-dark',
        className,
      )}
    >
      {products.map((product, index) => (
        <CollectionItem product={product} index={index} key={product.id} />
      ))}
    </div>
  );
}
