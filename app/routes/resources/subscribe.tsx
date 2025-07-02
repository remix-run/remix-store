import { data } from "react-router";
import type { Route } from "./+types/subscribe";
import { CreateShopifyAdminClient } from "~/lib/data/subscribe.server";
import * as z from "zod/v4";

// TODO: handle redirect for when JS hasn't loaded yet

const subscribeSchema = z.object({
  email: z.email("Please enter a valid email address"),
  variantId: z.string("Variant ID is required").min(1),
  variantTitle: z.string("Variant title is required"),
});

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data(
      { error: "Method not allowed", success: false },
      { status: 405 },
    );
  }

  const form = await request.formData();

  const validationResult = subscribeSchema.safeParse({
    email: form.get("email"),
    variantId: form.get("variantId"),
    variantTitle: form.get("variantTitle"),
  });

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return data({ error: firstError.message, success: false }, { status: 400 });
  }

  const { email, variantId, variantTitle } = validationResult.data;

  try {
    const adminClient = new CreateShopifyAdminClient(context);

    // Create product notification tag
    const productTag = variantTitle
      ? `notify-${variantId}-${variantTitle.toLowerCase().replace(/\s+/g, "-")}`
      : `notify-${variantId}`;

    const baseTag = "out-of-stock-subscriber";

    // Step 1: Check if customer exists
    const existingCustomer = await adminClient.getCustomerByEmail(email);

    if (existingCustomer) {
      // Step 2a: Update existing customer tags and email marketing consent
      const existingTags = existingCustomer.tags || [];
      const newTags = [...new Set([...existingTags, productTag, baseTag])];

      // Update customer tags
      await adminClient.updateCustomer({
        id: existingCustomer.id,
        tags: newTags,
      });

      // Update email marketing consent
      await adminClient.updateEmailMarketingConsent({
        customerId: existingCustomer.id,
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: new Date().toISOString(),
        },
      });
    } else {
      // Step 2b: Create new customer
      await adminClient.createCustomer({
        email,
        tags: [productTag, baseTag],
        emailMarketingConsent: {
          marketingState: "SUBSCRIBED",
          marketingOptInLevel: "SINGLE_OPT_IN",
          consentUpdatedAt: new Date().toISOString(),
        },
      });
    }

    // Step 3: Success response
    return data(
      {
        success: true,
        message: "Thanks! We'll notify you when this item is back in stock.",
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Subscribe action error:", error);

    // TODO: return {error: message} instead of throwing errors where appropriate, this should just be a final catch all

    return data(
      {
        error: error.message || "Something went wrong. Please try again.",
        success: false,
      },
      { status: 500 },
    );
  }
}
