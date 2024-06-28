import {Link} from '@remix-run/react';
import {Money} from '@shopify/hydrogen';
import type {RecommendedProductsQuery} from 'storefrontapi.generated';
import {Image} from '~/components/Image';
import {parseGradientColors} from '~/lib/metafields';
import clsx from 'clsx';

interface CollectionItemProps {
  product: RecommendedProductsQuery['products']['nodes'][0];
}

export function CollectionItem({product}: CollectionItemProps) {
  const {handle, title} = product;
  const price = product?.priceRange.minVariantPrice;
  // temporary value, we need to add the logic to the product admin
  const isOnSale = false;
  const gradients = parseGradientColors(product.gradientColors);

  return (
    <Link
      className="hover:no-underline"
      prefetch="intent"
      to={`/products/${handle}`}
    >
      <div
        className={clsx(
          'rounded-2xl bg-white dark:bg-black card-shadow-light dark:card-shadow-dark relative overflow-hidden aspect-ratio isolate max-w-[445px] max-h-[445px]',
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
  products?: RecommendedProductsQuery['products'];
}

export function CollectionGrid({products}: ColllectionGridProps) {
  if (!products) return null;
  return (
    <div className="py-12 px-3 md:px-12 grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 bg-neutral-200 dark:bg-neutral-700 ">
      {products.nodes.map((product) => (
        <CollectionItem product={product} key={product.id} />
      ))}
    </div>
  );
}
