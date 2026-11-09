import * as fd from "remix/data-schema/experimental/form";

import {
  PRODUCT_MESSAGE,
  SubscriptionForm,
} from "../lib/public/subscription-form.ts";

export const BACK_IN_STOCK_TAG = "back-in-stock-subscriber";

/** The native control names the form may submit. */
const FIELD_NAMES: ReadonlySet<string> = new Set(
  Object.entries(SubscriptionForm.entries).map(
    ([key, entry]) => entry.name ?? key,
  ),
);

/** A failure for the form to show, with any email to put back. */
export function formFailure(
  message: string,
  email?: string,
): fd.FormSubmission & { success: false } {
  let errors = { fields: {}, form: [message] };
  return { success: false, errors, values: email ? { email } : {} };
}

export function parseSubscriptionForm(form: FormData) {
  // Scalar fields read the first entry, so reject anything repeated or unknown.
  for (let name of form.keys()) {
    if (!FIELD_NAMES.has(name) || form.getAll(name).length !== 1) {
      return formFailure("The form submission is invalid.");
    }
  }

  let result = fd.parseSafe(SubscriptionForm, form);
  // A back-in-stock signup needs both the product and its variant.
  if (
    result.success &&
    Boolean(result.value.productHandle) !== Boolean(result.value.variantId)
  ) {
    return formFailure(PRODUCT_MESSAGE, result.value.email);
  }
  return result;
}

export function backInStockTags(
  productHandle: string,
  variantTitle: string,
  variantId: string,
): string[] {
  let variantNumber = variantId.split("/").at(-1)!;
  let title =
    variantTitle
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || `variant-${variantNumber}`;
  let suffix = "-back-in-stock-subscriber";
  let identity = `${productHandle}-${title}`;
  if (identity.length + suffix.length > 255) {
    let uniqueSuffix = `-${variantNumber}`;
    identity = `${identity.slice(0, 255 - suffix.length - uniqueSuffix.length)}${uniqueSuffix}`;
  }
  return [BACK_IN_STOCK_TAG, `${identity}${suffix}`];
}
