import * as schema from "remix/data-schema";
import { email, maxLength } from "remix/data-schema/checks";
import * as formData from "remix/data-schema/form-data";

export const BACK_IN_STOCK_TAG = "back-in-stock-subscriber";

export interface SubscriptionFormInput {
  consent: true;
  email: string;
  productHandle?: string;
  variantId?: string;
}

export interface SubscriptionValidationError {
  message: string;
}

const ALLOWED_FIELDS = new Set([
  "consent",
  "email",
  "product-handle",
  "variant-id",
]);
const EmailFormSchema = formData.object({
  email: formData.field(
    schema
      .string()
      .pipe(maxLength(254), email())
      .refine((value) => value.trim() === value)
      .transform((value) => value.toLowerCase()),
  ),
});
const ConsentFormSchema = formData.object({
  consent: formData.field(schema.literal("yes").transform((): true => true)),
});
const OptionalProductValueSchema = schema.union([
  schema.string().transform((value) => value || undefined),
  schema.null_().transform(() => undefined),
  schema.instanceof_(Blob).transform(() => undefined),
]);
const ProductFormSchema = schema
  .object({
    productHandle: OptionalProductValueSchema,
    variantId: OptionalProductValueSchema,
  })
  .refine(
    ({ productHandle, variantId }) =>
      Boolean(productHandle) === Boolean(variantId) &&
      (!productHandle || /^[a-z0-9][a-z0-9-]{0,254}$/.test(productHandle)) &&
      (!variantId ||
        /^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(variantId)),
  );

export function parseSubscriptionForm(
  form: FormData,
): SubscriptionFormInput | SubscriptionValidationError {
  for (let name of form.keys()) {
    if (!ALLOWED_FIELDS.has(name) || form.getAll(name).length !== 1) {
      return { message: "The form submission is invalid." };
    }
  }

  let emailResult = schema.parseSafe(EmailFormSchema, form);
  if (!emailResult.success) {
    return { message: "Please enter a valid email address." };
  }
  let consentResult = schema.parseSafe(ConsentFormSchema, form);
  if (!consentResult.success) {
    return { message: "Please confirm that you agree to receive emails." };
  }
  let productResult = schema.parseSafe(ProductFormSchema, {
    productHandle: form.get("product-handle"),
    variantId: form.get("variant-id"),
  });
  if (!productResult.success) {
    return { message: "The product subscription is invalid." };
  }
  return {
    consent: consentResult.value.consent,
    email: emailResult.value.email,
    productHandle: productResult.value.productHandle,
    variantId: productResult.value.variantId,
  };
}

export function isSubscriptionValidationError(
  value: SubscriptionFormInput | SubscriptionValidationError,
): value is SubscriptionValidationError {
  return "message" in value;
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
