import * as s from "remix/data-schema";
import { email, maxLength } from "remix/data-schema/checks";
import * as fd from "remix/data-schema/experimental/form";

import { marketPath, type MarketPathPrefix } from "./market.ts";

export interface SubscriptionEnabledProduct {
  subscribeIfBackInStock?: { value: string } | null;
}

/** Browser-safe predicate for the public product hydration graph. */
export function productSubscriptionsEnabled(
  product: SubscriptionEnabledProduct,
): boolean {
  return product.subscribeIfBackInStock?.value.trim().toLowerCase() === "true";
}

export const PRODUCT_MESSAGE = "The product subscription is invalid.";

/**
 * The signup form's fields. The server parses submissions with it and the
 * browser binds the form's controls to it, so both enforce the same rules.
 * Keys are logical names; `name` is the submitted control name.
 */
export const SubscriptionForm = fd.object({
  email: fd.text(
    s
      .string()
      .pipe(maxLength(254), email())
      .transform((value) => value.toLowerCase()),
    { errorMap: () => "Please enter a valid email address." },
  ),
  // Subscribing is the consent. The control is hidden and always "yes", so
  // the server can tell a deliberate signup from a stray request.
  consent: fd.text(
    s.literal("yes").transform((): true => true),
    { errorMap: () => "Please confirm that you agree to receive emails." },
  ),
  productHandle: fd.text(
    s.optional(
      s.string().refine((value) => /^[a-z0-9][a-z0-9-]{0,254}$/.test(value)),
    ),
    { errorMap: () => PRODUCT_MESSAGE, name: "product-handle" },
  ),
  variantId: fd.text(
    s.optional(
      s
        .string()
        .refine((value) =>
          /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(value),
        ),
    ),
    { errorMap: () => PRODUCT_MESSAGE, name: "variant-id" },
  ),
});

/** The frame the signup form renders in, so a submission replaces only it. */
export const SUBSCRIBE_FRAME = "subscribe";

/** A back-in-stock signup's product, as its form and URLs carry it. */
export interface SubscriptionProduct {
  handle: string;
  variantId: string;
}

/**
 * Marks the variant a signup without JavaScript just subscribed to, on the
 * product page it returns to and in its form's URL. It carries no form data.
 */
export const SUBSCRIBED_PARAM = "subscribed";

// Browser modules cannot import the route contract in app/routes.ts, so this
// mirrors `routes.subscribe`. Keep them in sync.
const SUBSCRIBE_PATH = "/subscribe";

/**
 * Where the signup form is served and posts. A product makes it that
 * variant's back-in-stock form; `subscribed` shows its confirmation.
 */
export function subscribeFormSrc(
  pathPrefix: MarketPathPrefix,
  product?: SubscriptionProduct,
  { subscribed = false }: { subscribed?: boolean } = {},
): string {
  let params = new URLSearchParams();
  if (product) {
    params.set("product-handle", product.handle);
    params.set("variant-id", product.variantId);
    if (subscribed) params.set(SUBSCRIBED_PARAM, product.variantId);
  }
  let src = marketPath(SUBSCRIBE_PATH, pathPrefix);
  return params.size ? `${src}?${params}` : src;
}

/** The back-in-stock product in a signup form's URL. */
export function productFromSearch(
  params: URLSearchParams,
): SubscriptionProduct | undefined {
  let handle = params.get("product-handle");
  let variantId = params.get("variant-id");
  return handle && variantId ? { handle, variantId } : undefined;
}

/** Whether `search` confirms a back-in-stock signup for `variantId`. */
export function isSubscribed(
  search: string | URLSearchParams,
  variantId: string,
): boolean {
  return new URLSearchParams(search).get(SUBSCRIBED_PARAM) === variantId;
}
