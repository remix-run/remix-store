import { useFetcher, data, redirect } from "react-router";
import { generateMeta } from "~/lib/meta";
import { PageTitle } from "~/components/page-title";
import { Icon } from "~/components/icon";
import { cva } from "class-variance-authority";
import { cn } from "~/lib/cn";
import { ShopifyCustomer } from "~/lib/data/subscribe.server";
import { isValidRedirect } from "~/lib/redirect";
import * as z from "zod";
import type { Route } from "./+types/($locale).subscribe";

const subscribeSchema = z.object({
  email: z.email("Please enter a valid email address."),
  variantHandle: safeTagStringSchema("Variant handle", false).optional(),
  variantTitle: safeTagStringSchema("Variant title", true).optional(),
  redirectTo: z.string().nullish(),
});

export function meta({ matches }: Route.MetaArgs) {
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: "Subscribe",
    description:
      "Subscribe to receive updates on new products and special offers",
    url: siteUrl,
  });
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data(
      { error: "Method not allowed", success: false },
      { status: 405 },
    );
  }

  const form = await request.formData();

  // Convert null or empty strings to undefined for optional fields
  const variantHandleRaw = form.get("variant-handle");
  const variantTitleRaw = form.get("variant-title");

  const validationResult = subscribeSchema.safeParse({
    email: form.get("email"),
    variantHandle: normalizeOptionalField(variantHandleRaw),
    variantTitle: normalizeOptionalField(variantTitleRaw),
    redirectTo: form.get("redirectTo"),
  });

  if (!validationResult.success) {
    console.error(validationResult.error);
    const firstError = validationResult.error.issues[0];
    return data({ error: firstError.message, success: false }, { status: 400 });
  }

  let {
    email,
    variantHandle,
    variantTitle,
    redirectTo: redirectUrl,
  } = validationResult.data;

  let tags: string[] = [];
  let successMessage =
    "Thanks for subscribing! We'll keep you updated on all our latest news.";

  if (variantHandle && variantTitle) {
    // Product-specific back-in-stock subscription
    // At this point, both variantHandle and variantTitle are guaranteed to be defined
    const sanitizedVariantTitle = variantTitle!
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-") // Replace one or more spaces with a single hyphen
      .replace(/--+/g, "-") // Replace multiple consecutive hyphens with a single hyphen
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens

    tags = [
      `back-in-stock-subscriber`,
      `${variantHandle}-${sanitizedVariantTitle}-back-in-stock-subscriber`,
    ];
    successMessage =
      "Thanks for subscribing! We'll let you know when it's back in stock.";
  }

  try {
    const customerClient = new ShopifyCustomer(context);
    const existingCustomer = await customerClient.getCustomerByEmail(email);

    if (existingCustomer) {
      const existingTags = existingCustomer.tags;
      const newTags = [...new Set([...existingTags, ...tags])];

      await customerClient.updateCustomerTags({
        id: existingCustomer.id,
        tags: newTags,
      });

      await customerClient.subscribeCustomer({
        customerId: existingCustomer.id,
      });
    } else {
      await customerClient.createAndSubscribeCustomer({
        email,
        tags,
      });
    }

    if (redirectUrl && isValidRedirect(redirectUrl)) {
      return redirect(redirectUrl);
    }

    // Otherwise, return data for hydrated form (JS loaded)
    return data(
      {
        success: true,
        message: successMessage,
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Subscribe action error:", error);

    return data(
      {
        error: "Something went wrong. Please try again.",
        success: false,
      },
      { status: 500 },
    );
  }
}

let subscribeButtonVariants = cva(
  [
    "relative flex min-h-16 items-center justify-center overflow-hidden rounded-[54px] px-6 py-4 text-xl font-semibold whitespace-nowrap duration-300 transition-colors w-full",
  ],
  {
    variants: {
      state: {
        idle: "bg-white text-black",
        success: "bg-green-brand text-white",
      },
      disabled: {
        true: "bg-white/20 text-white/80",
      },
    },
    defaultVariants: {
      state: "idle",
      disabled: false,
    },
  },
);

export default function Subscribe() {
  let fetcher = useFetcher<{
    success?: boolean;
    message?: string;
    error?: string;
  }>();
  let isSubmitting = fetcher.state === "submitting";
  let isSuccess = fetcher.data?.success;
  let errorMessage = fetcher.data?.error;
  let successMessage = fetcher.data?.message;

  return (
    <main>
      <PageTitle>Subscribe</PageTitle>
      <div className="mx-auto max-w-[700px] px-4">
        <div className="flex flex-col gap-6 pb-36">
          <p className="text-white/90 text-base lg:text-lg">
            Stay up to date with our latest products, special offers, and news.
            Enter your email below to subscribe.
          </p>

          <fetcher.Form
            method="post"
            className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-3"
          >
            <div className="flex flex-col lg:col-span-2">
              <label htmlFor="subscribe-email" className="sr-only">
                Email address for updates
              </label>
              <input
                id="subscribe-email"
                type="email"
                name="email"
                placeholder="run@remix.run"
                required
                disabled={isSubmitting}
                onChange={() => {
                  if (isSuccess) {
                    fetcher.reset();
                  }
                }}
                className={cn(
                  "focus-visible:ring-blue-brand w-full rounded-[54px] border-[3px] px-6 py-4 text-lg font-semibold outline-none placeholder:text-xl placeholder:text-white/60 focus-visible:ring-2",
                  isSuccess
                    ? "border-green-brand text-green-brand autofill:text-green-brand"
                    : "border-white text-white",
                )}
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                subscribeButtonVariants({
                  state: isSuccess ? "success" : "idle",
                  disabled: isSubmitting,
                }),
                "lg:col-span-1",
              )}
            >
              <span className="absolute inset-0" />
              {isSuccess ? (
                <Icon name="check" className="add-to-cart-icon size-8" />
              ) : isSubmitting ? (
                "Subscribing..."
              ) : (
                "Subscribe"
              )}
            </button>
          </fetcher.Form>

          <div className="text-xs text-white/60 lg:text-sm">
            {isSuccess ? (
              <p>{successMessage}</p>
            ) : errorMessage ? (
              <p className="text-red-brand">{errorMessage}</p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}

/**
 * Validates that a string contains only safe characters for Shopify tags.
 * Allows: alphanumeric, hyphens, underscores, and spaces (for titles).
 */
function safeTagStringSchema(fieldName: string, allowSpaces = false) {
  return z
    .string(`${fieldName} is required.`)
    .min(1, `${fieldName} cannot be empty.`)
    .max(100, `${fieldName} is too long.`)
    .regex(
      allowSpaces ? /^[a-zA-Z0-9\s_-]+$/ : /^[a-zA-Z0-9_-]+$/,
      `${fieldName} contains invalid characters. Only letters, numbers, hyphens, and underscores are allowed.`,
    );
}

function normalizeOptionalField(
  value: FormDataEntryValue | null,
): string | undefined {
  if (value === null || value === "") return undefined;
  return typeof value === "string" ? value : undefined;
}
