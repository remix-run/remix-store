import * as schema from "remix/data-schema";
import { email, maxLength } from "remix/data-schema/checks";
import * as fd from "remix/data-schema/experimental/form";

import { routes } from "../../routes.ts";
import { marketPath, type MarketPathPrefix } from "./market.ts";

export const PRODUCT_MESSAGE = "The product subscription is invalid.";

/**
 * The signup form's submitted fields. The server parses submissions with it
 * and the browser binds its controls to it, so both enforce the same rules.
 * Object keys are logical names; `name` is the native control's name.
 */
export const SubscriptionForm = fd.object({
  email: fd.text(
    schema
      .string()
      .pipe(maxLength(254), email())
      .transform((value) => value.toLowerCase()),
    { errorMap: () => "Please enter a valid email address." },
  ),
  // Subscribing is the consent. The control is hidden and always "yes", so the
  // server can tell a deliberate signup from a stray request.
  consent: fd.text(
    schema.literal("yes").transform((): true => true),
    {
      errorMap: () => "Please confirm that you agree to receive emails.",
    },
  ),
  productHandle: fd.text(
    schema.optional(
      schema
        .string()
        .refine((value) => /^[a-z0-9][a-z0-9-]{0,254}$/.test(value)),
    ),
    { errorMap: () => PRODUCT_MESSAGE, name: "product-handle" },
  ),
  variantId: fd.text(
    schema.optional(
      schema
        .string()
        .refine((value) =>
          /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(value),
        ),
    ),
    { errorMap: () => PRODUCT_MESSAGE, name: "variant-id" },
  ),
});

/**
 * Where the signup form is served and posts. A product and variant make it
 * that variant's back-in-stock form.
 */
export function subscribeFormSrc(
  pathPrefix: MarketPathPrefix,
  product?: { handle: string; variantId: string },
  /** What a signup without scripts left behind, for the frame to show. */
  subscription?: string,
): string {
  let params = new URLSearchParams();
  if (product) {
    params.set("product-handle", product.handle);
    params.set("variant-id", product.variantId);
  }
  if (subscription) params.set("subscription", subscription);
  let src = marketPath(routes.subscribe.index.href(), pathPrefix);
  return params.size ? `${src}?${params}` : src;
}

/** The product a back-in-stock form is for, read from its URL. */
export function productFromSearch(params: URLSearchParams) {
  let handle = params.get("product-handle");
  let variantId = params.get("variant-id");
  return handle && variantId ? { handle, variantId } : undefined;
}
