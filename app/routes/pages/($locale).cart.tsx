import { useRouteLoaderData, type MetaArgs } from "@remix-run/react";
import type { CartQueryDataReturn } from "@shopify/hydrogen";
import { CartForm, Money, useOptimisticCart } from "@shopify/hydrogen";
import { data, type ActionFunctionArgs } from "@shopify/remix-oxygen";
import type { RootLoader } from "~/root";
import { generateMeta } from "~/lib/meta";
import { PageTitle } from "~/components/page-title";
import { CartHeader, CartLineItem, CheckoutLink } from "~/components/cart";
import { clsx } from "clsx";

export function meta({ matches }: MetaArgs<undefined, { root: RootLoader }>) {
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: "The Remix Store | Cart",
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
  let cart = useOptimisticCart(rootData?.cart);
  // TODO: figure out the empty cart state
  if (!cart) return null;

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
