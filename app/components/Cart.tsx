import {
  CartForm,
  Money,
  useOptimisticCart,
  type OptimisticCart,
} from '@shopify/hydrogen';
import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import {Link} from '@remix-run/react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {Image} from '~/components/Image';
import {parseGradientColors} from '~/lib/metafields';
import clsx from 'clsx';

type CartLine = OptimisticCart<CartApiQueryFragment>['lines']['nodes'][0];

type CartMainProps = {
  cart: CartApiQueryFragment | null;
  layout: 'page' | 'aside';
};

export function CartMain({layout, cart: originalCart}: CartMainProps) {
  const cart = useOptimisticCart(originalCart);

  const linesCount = Boolean(cart?.lines?.nodes?.length || 0);
  const withDiscount =
    cart &&
    Boolean(cart?.discountCodes?.filter((code) => code.applicable)?.length);

  // TODO: cart main vs sidecart in tailwind
  const className = `cart-main ${withDiscount ? 'with-discount' : ''}`;

  return (
    <div className={clsx(className)}>
      <CartEmpty hidden={linesCount} layout={layout} />
      <CartDetails cart={cart} layout={layout} />
    </div>
  );
}

function CartDetails({
  layout,
  cart,
}: {
  cart: OptimisticCart<CartApiQueryFragment>;
  layout: 'page' | 'aside';
}) {
  const cartHasItems = !!cart && cart.totalQuantity > 0;
  if (!cartHasItems) return null;

  return (
    <div className="cart-details">
      <p>
        There are <strong>{cart.totalQuantity}</strong> items in this cart
      </p>
      <CartLines lines={cart?.lines?.nodes} layout={layout} />
      {cartHasItems && (
        <CartSummary layout={layout}>
          <CartSubTotal subtotalAmount={cart.cost.subtotalAmount} />
          <CartDiscounts discountCodes={cart.discountCodes} />
          <CartCheckoutActions checkoutUrl={cart.checkoutUrl} />
        </CartSummary>
      )}
    </div>
  );
}

function CartLines({
  lines,
  layout,
}: {
  layout: CartMainProps['layout'];
  lines: CartLine[];
}) {
  if (!lines) return null;

  return (
    <div aria-labelledby="cart-lines" className={clsx('')}>
      <ul>
        {lines.map((line) => (
          <CartLineItem key={line.id} line={line} layout={layout} />
        ))}
      </ul>
    </div>
  );
}

function CartLineItem({
  layout,
  line,
}: {
  layout: CartMainProps['layout'];
  line: CartLine;
}) {
  const {id, merchandise} = line;
  const {product, title, image, selectedOptions} = merchandise;
  const lineItemUrl = useVariantUrl(product.handle, selectedOptions);
  const gradients = parseGradientColors(product.gradientColors);

  return (
    <li
      key={id}
      className={clsx('cart-line', 'flex first:pt-8 py-4 last:pb-8')}
    >
      {image && (
        <div className="w-[148px] h-[148px]">
          <Image
            alt={title}
            aspectRatio="1/1"
            data={image}
            height={100}
            loading="lazy"
            width={100}
            gradient={gradients[0]}
            gradientFade
          />
        </div>
      )}

      <div className={clsx('ml-6 flex flex-col')}>
        <Link
          prefetch="intent"
          to={lineItemUrl}
          onClick={() => {
            if (layout === 'aside') {
              // close the drawer
              window.location.href = lineItemUrl;
            }
          }}
        >
          <p>
            <strong>{product.title}</strong>
          </p>
        </Link>
        <CartLinePrice line={line} as="span" />
        <ul>
          {selectedOptions.map((option) => {
            const isDefaultVariant = option.value === 'Default Title';
            if (isDefaultVariant) return null;
            return (
              <li key={option.name}>
                <small>
                  {option.name}: {option.value}
                </small>
              </li>
            );
          })}
        </ul>
        <CartLineQuantity line={line} />
      </div>
    </li>
  );
}

function CartCheckoutActions({checkoutUrl}: {checkoutUrl: string}) {
  if (!checkoutUrl) return null;

  return (
    <div className="pt-8 flex">
      <a className="m-0 p-0 block" href={checkoutUrl} target="_self">
        <p>Continue to checkout</p>
      </a>
      <br />
    </div>
  );
}

function CartSubTotal({
  subtotalAmount,
}: {
  subtotalAmount: CartApiQueryFragment['cost']['subtotalAmount'];
}) {
  return (
    <dl className={clsx('flex justify-between w-full')}>
      <dt className="text-xl">Subtotal</dt>
      <dd>
        {subtotalAmount?.amount ? (
          <p className="inline-flex">
            <span className="mr-3">{subtotalAmount.currencyCode}</span>
            <Money as="strong" data={subtotalAmount} />
          </p>
        ) : (
          '-'
        )}
      </dd>
    </dl>
  );
}

export function CartSummary({
  layout,
  children = null,
}: {
  children?: React.ReactNode;
  layout: CartMainProps['layout'];
}) {
  const className =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

  return (
    <div
      aria-labelledby="cart-summary"
      className={clsx(
        className,
        'absolute left-0 bottom-0 bg-lightGray dark:bg-gray p-8 w-[586px]',
      )}
    >
      {children}
    </div>
  );
}

function CartLineRemoveButton({
  lineIds,
  disabled,
}: {
  lineIds: string[];
  disabled: boolean;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesRemove}
      inputs={{lineIds}}
    >
      <button disabled={disabled} type="submit">
        Remove
      </button>
    </CartForm>
  );
}

function CartLineQuantity({line}: {line: CartLine}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="cart-line-quantity">
      <small>Quantity: {quantity} &nbsp;&nbsp;</small>
      <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
        <button
          aria-label="Decrease quantity"
          disabled={quantity <= 1 || !!isOptimistic}
          name="decrease-quantity"
          value={prevQuantity}
        >
          <span>&#8722; </span>
        </button>
      </CartLineUpdateButton>
      &nbsp;
      <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
        <button
          aria-label="Increase quantity"
          name="increase-quantity"
          value={nextQuantity}
          disabled={!!isOptimistic}
        >
          <span>&#43;</span>
        </button>
      </CartLineUpdateButton>
      &nbsp;
      <CartLineRemoveButton lineIds={[lineId]} disabled={!!isOptimistic} />
    </div>
  );
}

function CartLinePrice({
  line,
  priceType = 'regular',
  ...passthroughProps
}: {
  line: CartLine;
  priceType?: 'regular' | 'compareAt';
  [key: string]: any;
}) {
  if (!line?.cost?.amountPerQuantity || !line?.cost?.totalAmount)
    return <div style={{visibility: 'hidden'}}>&nbsp;</div>;

  const moneyV2 =
    priceType === 'regular'
      ? line.cost.totalAmount
      : line.cost.compareAtAmountPerQuantity;

  if (moneyV2 == null) {
    return <div style={{visibility: 'hidden'}}>&nbsp;</div>;
  }

  return (
    <div>
      <Money withoutTrailingZeros {...passthroughProps} data={moneyV2} />
    </div>
  );
}

export function CartEmpty({
  hidden = false,
  layout = 'aside',
}: {
  hidden: boolean;
  layout?: CartMainProps['layout'];
}) {
  const ctaUrl = '/collections/all';
  return (
    <div hidden={hidden}>
      <br />
      <p>There are no items in this cart.</p>
      <br />
      <Link
        to={ctaUrl}
        onClick={() => {
          if (layout === 'aside') {
            window.location.href = ctaUrl;
          }
        }}
      >
        What&apos;s new? →
      </Link>
    </div>
  );
}

function CartDiscounts({
  discountCodes,
}: {
  discountCodes: CartApiQueryFragment['discountCodes'];
}) {
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  return (
    <div className={clsx('pt-8')}>
      {/* Have existing discount, display it with a remove option */}
      <dl hidden={!codes.length}>
        <div>
          <dt>Discount(s)</dt>
          <UpdateDiscountForm>
            <div className="cart-discount">
              <code>{codes?.join(', ')}</code>
              &nbsp;
              <button>Remove</button>
            </div>
          </UpdateDiscountForm>
        </div>
      </dl>

      {/* Show an input to apply a discount */}
      {!codes && (
        <UpdateDiscountForm discountCodes={codes}>
          <div className={clsx('w-100 flex justify-between')}>
            <input
              type="text"
              name="discountCode"
              placeholder="Enter promo code"
              className={clsx(
                'bg-lightGray dark:bg-black p-4 w-full rounded-l-input',
              )}
            />
            <div className="bg-lightGray dark:bg-black rounded-r-input">
              <button type="submit" className="mr-4 w-[108px] h-[56px]">
                APPLY CODE
              </button>
            </div>
          </div>
        </UpdateDiscountForm>
      )}
    </div>
  );
}

function UpdateDiscountForm({
  discountCodes,
  children,
}: {
  discountCodes?: string[];
  children: React.ReactNode;
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.DiscountCodesUpdate}
      inputs={{
        discountCodes: discountCodes || [],
      }}
    >
      {children}
    </CartForm>
  );
}

function CartLineUpdateButton({
  children,
  lines,
}: {
  children: React.ReactNode;
  lines: CartLineUpdateInput[];
}) {
  return (
    <CartForm
      route="/cart"
      action={CartForm.ACTIONS.LinesUpdate}
      inputs={{lines}}
    >
      {children}
    </CartForm>
  );
}
