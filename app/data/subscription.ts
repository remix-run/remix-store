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

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseSubscriptionForm(
  form: FormData,
): SubscriptionFormInput | SubscriptionValidationError {
  let allowedFields = new Set([
    "consent",
    "email",
    "product-handle",
    "variant-id",
  ]);
  for (let name of form.keys()) {
    if (!allowedFields.has(name) || form.getAll(name).length !== 1) {
      return { message: "The form submission is invalid." };
    }
  }
  let emailValue = form.get("email");
  let consentValue = form.get("consent");
  let productHandle = optionalString(form.get("product-handle"));
  let variantId = optionalString(form.get("variant-id"));

  if (
    typeof emailValue !== "string" ||
    emailValue.length > 254 ||
    emailValue.trim() !== emailValue ||
    !EMAIL_PATTERN.test(emailValue)
  ) {
    return { message: "Please enter a valid email address." };
  }
  if (consentValue !== "yes") {
    return { message: "Please confirm that you agree to receive emails." };
  }
  if (Boolean(productHandle) !== Boolean(variantId)) {
    return { message: "The product subscription is invalid." };
  }
  if (
    (productHandle && !/^[a-z0-9][a-z0-9-]{0,254}$/.test(productHandle)) ||
    (variantId &&
      !/^gid:\/\/shopify\/ProductVariant\/[1-9][0-9]*$/.test(variantId))
  ) {
    return { message: "The product subscription is invalid." };
  }
  return {
    consent: true,
    email: emailValue.toLowerCase(),
    productHandle,
    variantId,
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

function optionalString(value: FormDataEntryValue | null): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
