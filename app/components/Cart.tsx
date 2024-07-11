import {
  CartForm,
  Money,
  useOptimisticCart,
  type OptimisticCart,
} from '@shopify/hydrogen';
import type {CartLineUpdateInput} from '@shopify/hydrogen/storefront-api-types';
import {Link, type FetcherWithComponents} from '@remix-run/react';
import type {CartApiQueryFragment} from 'storefrontapi.generated';
import {useVariantUrl} from '~/lib/variants';
import {Image} from '~/components/Image';
import {parseGradientColors} from '~/lib/metafields';
import clsx from 'clsx';
import {Button} from '~/components/ui/button';
import Icon from '~/components/Icon';
import {useRef} from 'react';

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
    <div className={clsx('w-full h-full')}>
      <CartEmpty hidden={linesCount} layout={layout} />
      <CartDetails hidden={!linesCount} cart={cart} layout={layout} />
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
    <div
      className={clsx('p-8 w-full flex-col h-full', hidden ? 'hidden' : 'flex')}
    >
      <p>There are no items in this cart.</p>
      <div className="mt-auto">
        <Link
          to={ctaUrl}
          onClick={() => {
            if (layout !== 'aside') return;
            window.location.href = ctaUrl;
          }}
        >
          <Button variant="secondary" size="lg">
            <span>Back to shop</span>
          </Button>
        </Link>
      </div>
    </div>
  );
}

function CartDetails({
  hidden = true,
  layout,
  cart,
}: {
  cart: OptimisticCart<CartApiQueryFragment>;
  layout: 'page' | 'aside';
  hidden: boolean;
}) {
  const cartHasItems = !!cart && cart.totalQuantity > 0;
  if (!cartHasItems) return null;

  return (
    <div className={clsx('h-full p-8 flex-col', hidden ? 'hidden' : 'flex')}>
      <p className="mb-8">
        There are <strong>{cart.totalQuantity}</strong> items in this cart
      </p>
      <CartLines lines={cart?.lines?.nodes} layout={layout} />
      {cartHasItems && (
        <CartSummary layout={layout}>
          <CartSubTotal subtotalAmount={cart.cost.subtotalAmount} />
          <CartDiscounts discountCodes={cart.discountCodes} />
          <CheckoutButton checkoutUrl={cart.checkoutUrl} />
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

  // This height is calculated based on:
  //  100vh (viewport height)
  // - 110px (header height)
  // - 280px (cart summary height)
  // - 24px (cart lines total quantity height)
  const cartLinesHeight = `max-h-[calc(100vh-_478px)]`;

  return (
    <div
      aria-labelledby="cart-lines"
      className={clsx('overflow-y-scroll', cartLinesHeight)}
    >
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
      className={clsx('cart-line', 'flex first:pt-0 py-4 last:pb-8')}
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
            <strong className="tracking-tight text-xl text-black dark:text-white">
              {product.title}
            </strong>
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
  className,
}: {
  children?: React.ReactNode;
  layout: CartMainProps['layout'];
  className?: string;
}) {
  const classes =
    layout === 'page' ? 'cart-summary-page' : 'cart-summary-aside';

  const summaryHeight = `h-[280px]`;

  return (
    <div
      aria-labelledby="cart-summary"
      className={clsx(
        classes,
        className,
        // should be conditional wether user has already inputted a discount or not
        summaryHeight,
        'absolute left-0 bottom-0 bg-lightGray dark:bg-gray',
        'p-8 w-full',
      )}
    >
      {children}
    </div>
  );
}

function CartLineRemoveButton({
  children,
  lineIds,
}: {
  children: React.ReactNode;
  lineIds: string[];
}) {
  return (
    <div className="ml-auto">
      <CartForm
        action={CartForm.ACTIONS.LinesRemove}
        inputs={{lineIds}}
        route="/cart"
      >
        {children}
      </CartForm>
    </div>
  );
}

function CartLineQuantity({line}: {line: CartLine}) {
  if (!line || typeof line?.quantity === 'undefined') return null;
  const {id: lineId, quantity, isOptimistic} = line;
  const prevQuantity = Number(Math.max(0, quantity - 1).toFixed(0));
  const nextQuantity = Number((quantity + 1).toFixed(0));

  return (
    <div className="mt-3 p-[1px] flex bg-darkGray dark:bg-darkBlack rounded-input w-[194px]">
      <div className="flex justify-between items-center px-5">
        <CartLineUpdateButton lines={[{id: lineId, quantity: prevQuantity}]}>
          <button
            disabled={!!isOptimistic}
            type="submit"
            value={prevQuantity}
            name="decrease-quantity"
          >
            <Icon
              name="minus"
              aria-label="Decrease quantity"
              className="dar:bg-red"
            />
          </button>
        </CartLineUpdateButton>
        <div className="w-12 font-bold text-center">{quantity}</div>
        <CartLineUpdateButton lines={[{id: lineId, quantity: nextQuantity}]}>
          <button
            disabled={!!isOptimistic}
            type="submit"
            value={nextQuantity}
            name="increase-quantity"
          >
            <Icon name="plus" aria-label="Increase quantity" />
          </button>
        </CartLineUpdateButton>
      </div>
      <CartLineRemoveButton lineIds={[lineId]}>
        <Button size="icon" disabled={!!isOptimistic} type="submit">
          <Icon name="trash" aria-label="Remove cart item" />
        </Button>
      </CartLineRemoveButton>
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

function CartDiscounts({
  discountCodes,
}: {
  discountCodes: CartApiQueryFragment['discountCodes'];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const codeEntered = Boolean(inputRef.current?.value);
  const codes: string[] =
    discountCodes
      ?.filter((discount) => discount.applicable)
      ?.map(({code}) => code) || [];

  const codeApplied = Boolean(codes.length);
  const codeEnteredInvalid = codeEntered && !codeApplied;

  return (
    <div className={clsx(codeEnteredInvalid ? 'pt-8 pb-2' : 'py-8')}>
      {/* Have existing discount, display it with a remove option */}
      {Boolean(codes.length) && (
        <div className="flex justify-between">
          <p className="h-[56px] rounded-input w-full p-5 text-blue-brand lh-5 leading-5 bg-lightGray dark:bg-black">
            Promo code applied
          </p>
        </div>
      )}

      {/* Show an input to apply a discount */}
      {!codes.length && (
        <UpdateDiscountForm discountCodes={codes}>
          <div
            className={clsx(
              'flex justify-between bg-lightGray dark:bg-black pl-5 w-full rounded-input',
            )}
          >
            <input
              type="text"
              ref={inputRef}
              name="discountCode"
              placeholder="Enter promo code"
              className={clsx(
                'font-bold uppercase font-sm lh-5 leading-5 my-5 bg-lightGray dark:bg-black',
                'focus:outline-none focus:ring-0 focus:border-transparent',
                'placeholder:normal-case placeholder:font-thin',
                'w-full',
              )}
            />
            <div className="mt-[1px] mr-[1px]">
              <Button type="submit" className="h-[56px] w-[140px]">
                APPLY CODE
              </Button>
            </div>
          </div>
        </UpdateDiscountForm>
      )}

      <span
        className={clsx(
          'text-error-brand text-xs mt-2',
          codeEnteredInvalid ? 'visible' : 'hidden',
        )}
      >
        The code you entered is invalid or has expired
      </span>
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
      {({data}: FetcherWithComponents<any>) => {
        return children;
      }}
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
    <div className="w-6 h-6">
      <CartForm
        route="/cart"
        action={CartForm.ACTIONS.LinesUpdate}
        inputs={{lines}}
      >
        {children}
      </CartForm>
    </div>
  );
}

function CheckoutButton({checkoutUrl}: {checkoutUrl: string}) {
  if (!checkoutUrl) return null;

  return (
    <div className="flex">
      <Button variant="tertiary" size="fw">
        <a className="m-0 p-0 block" href={checkoutUrl} target="_self">
          <p>Continue to checkout</p>
        </a>
      </Button>
    </div>
  );
}
