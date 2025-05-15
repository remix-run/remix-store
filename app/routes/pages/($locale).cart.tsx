import { useRouteLoaderData, type MetaArgs } from "react-router";
import type { CartQueryDataReturn } from "@shopify/hydrogen";
import { CartForm, Money, useOptimisticCart } from "@shopify/hydrogen";
import { data, type ActionFunctionArgs } from "@shopify/remix-oxygen";
import type { RootLoader } from "~/root";
import { generateMeta } from "~/lib/meta";
import { PageTitle } from "~/components/page-title";
import { CartHeader, CartLineItem, CheckoutLink } from "~/components/cart";
import { clsx } from "clsx";
import { MatrixText } from "~/components/matrix-text";
import { AnimatedLinkSpread } from "~/components/ui/animated-link";
import { Icon } from "~/components/icon";
import { isMagicHidden } from "~/lib/show-the-magic";

export function meta({ matches }: MetaArgs<undefined, { root: RootLoader }>) {
  const rootData = matches[0].data;
  if (isMagicHidden(rootData)) {
    return [];
  }
  const { siteUrl, cart } = rootData;
  return generateMeta({
    title: cart?.totalQuantity ? `Cart (${cart?.totalQuantity})` : "Cart",
    description: "View your shopping cart and checkout",
    url: siteUrl,
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const { cart } = context;

  const formData = await request.formData();

  const { action, inputs } = CartForm.getFormInput(formData);

  if (!action) {
    throw new Error("No action provided");
  }

  let status = 200;
  let result: CartQueryDataReturn;

  switch (action) {
    case CartForm.ACTIONS.LinesAdd:
      result = await cart.addLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesUpdate:
      result = await cart.updateLines(inputs.lines);
      break;
    case CartForm.ACTIONS.LinesRemove:
      result = await cart.removeLines(inputs.lineIds);
      break;
    case CartForm.ACTIONS.DiscountCodesUpdate: {
      const formDiscountCode = inputs.discountCode;

      // User inputted discount code
      const discountCodes = (
        formDiscountCode ? [formDiscountCode] : []
      ) as string[];

      // Combine discount codes already applied on cart
      discountCodes.push(...inputs.discountCodes);

      // check if discount code is valid (has appplicable)
      result = await cart.updateDiscountCodes(discountCodes);

      break;
    }
    case CartForm.ACTIONS.BuyerIdentityUpdate: {
      result = await cart.updateBuyerIdentity({
        ...inputs.buyerIdentity,
      });
      break;
    }
    default:
      throw new Error(`${action} cart action is not defined`);
  }

  const cartId = result?.cart?.id;
  const headers = cartId ? cart.setCartId(result.cart.id) : new Headers();
  const { cart: cartResult, errors } = result;

  const redirectTo = formData.get("redirectTo") ?? null;
  if (typeof redirectTo === "string") {
    status = 303;
    headers.set("Location", redirectTo);
  }

  headers.append("Set-Cookie", await context.session.commit());

  return data(
    {
      cart: cartResult,
      errors,
      analytics: {
        cartId,
      },
    },
    { status, headers },
  );
}

export default function Cart() {
  const rootData = useRouteLoaderData<RootLoader>("root");
  if (isMagicHidden(rootData)) throw new Error("Get out of here");
  let cart = useOptimisticCart(rootData?.cart);

  // Note -- this empty cart state is the same as the root ErrorBoundary -- if we propagate it again it's probably a good time to turn it into a component
  if (!cart || cart.lines?.nodes?.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center pt-[140px] pb-[140px] md:h-min md:pt-[200px] md:pb-[240]">
        <MatrixText
          // FIXME: Need a "cart" option
          text={"500"}
        />
        <div className="flex flex-col items-center gap-9 md:gap-12">
          <div className="flex flex-col items-center gap-3 md:gap-6">
            <h1 className="font-title text-3xl font-black tracking-[-0.2em] uppercase md:text-5xl md:tracking-[-0.2em]">
              No items in cart
            </h1>
            <p className="text-sm tracking-tight md:text-base md:tracking-tight">
              Please check the URL and try again -- you may be wondering why
              there is a 500 👆 -- we should probably fix that
            </p>
          </div>
          <AnimatedLinkSpread to="/collections/all" className="w-60">
            <Icon
              name="cart"
              className="size-8"
              fill="currentColor"
              aria-hidden="true"
            />
            <span>Shop All</span>
          </AnimatedLinkSpread>
        </div>
      </div>
    );
  }

  let totalQuantity = cart.totalQuantity || 0;

  let lines = cart.lines.nodes;
  let subtotalAmount = cart.cost?.subtotalAmount;
  let checkoutUrl = cart.checkoutUrl;
  let isOptimistic = Boolean(cart.isOptimistic);

  return (
    <main>
      <div className="hidden md:block">
        <PageTitle>Cart</PageTitle>
      </div>
      <div className="block h-28 md:hidden" />

      <div className="mx-auto flex max-w-[800px] flex-col gap-12 px-4 md:px-9">
        <CartHeader className="md:text-xl" totalQuantity={totalQuantity} />
        <div className="relative flex flex-1 flex-col gap-9">
          <ul className="flex flex-col gap-9">
            {lines.map((line) => (
              <CartLineItem
                key={line.id}
                line={line}
                isOptimistic={isOptimistic}
                className="gap-4"
              />
            ))}
          </ul>
          <div className="sticky right-0 bottom-0 left-0 z-10 bg-black py-4 md:sticky">
            <div className="mx-auto max-w-[800px]">
              <div className="flex w-full flex-col items-end gap-6">
                <div className="flex w-full flex-col items-start gap-1">
                  <div className="flex w-full items-center justify-between">
                    <p className="font-title tracking-tightest text-base font-black uppercase md:text-xl">
                      subtotal
                    </p>

                    {subtotalAmount ? (
                      <Money
                        className={clsx(
                          "text-base font-bold md:text-xl",
                          isOptimistic && "text-white/50",
                        )}
                        data={subtotalAmount}
                      />
                    ) : null}
                  </div>
                  <p className="text-center text-xs text-white/50">
                    Taxes & Shipping calculated at checkout
                  </p>
                </div>
                <div className="w-full md:w-[240px]">
                  <CheckoutLink
                    to={checkoutUrl ?? ""}
                    disabled={isOptimistic || !checkoutUrl}
                    className="hover:ring-0"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
