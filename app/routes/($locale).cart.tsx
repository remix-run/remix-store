import { useRouteLoaderData, type MetaArgs } from "@remix-run/react";
import type { CartQueryDataReturn } from "@shopify/hydrogen";
import { CartForm } from "@shopify/hydrogen";
import { data, type ActionFunctionArgs } from "@shopify/remix-oxygen";
import type { RootLoader } from "~/root";
import { generateMeta } from "~/lib/meta";
import { PageTitle } from "~/components/page-title";

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
  if (!rootData) return null;

  return (
    <div>
      <PageTitle>Cart</PageTitle>
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-32">
          <h2 className="font-title tracking-tightest mb-8 text-xl font-black uppercase">
            9 Item(s) in cart
          </h2>

          <div className="mb-8 flex flex-col gap-4">
            {/* Cart Item Template */}
            <div className="flex items-center gap-4">
              <div className="size-20 shrink-0 rounded-2xl bg-white p-2">
                {/* Image placeholder */}
                <div className="h-full w-full bg-gray-200" />
              </div>
              <div className="flex flex-1 items-start justify-between">
                <div className="flex flex-col gap-1">
                  <h3 className="font-bold">Product Name</h3>
                  <p className="text-sm text-gray-600">Variant</p>
                  <div className="mt-1 flex items-center gap-2">
                    <button className="rounded-full p-1 hover:bg-gray-100">
                      <span className="sr-only">Decrease quantity</span>−
                    </button>
                    <span className="w-8 text-center">1</span>
                    <button className="rounded-full p-1 hover:bg-gray-100">
                      <span className="sr-only">Increase quantity</span>+
                    </button>
                  </div>
                </div>
                <div className="font-bold">$XX.XX</div>
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-title tracking-tightest text-xl font-black uppercase">
                Subtotal
              </h2>
              <div className="font-bold">$XXX.XX</div>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              Taxes & Shipping calculated at checkout
            </p>
            <button className="w-full rounded-full bg-black px-6 py-4 font-semibold text-white transition-colors hover:bg-gray-800">
              Check out ▶
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
