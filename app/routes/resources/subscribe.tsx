import { data } from "react-router";
import type { Route } from "./+types/subscribe";
import { ShopifyCustomer } from "~/lib/data/subscribe.server";
import * as z from "zod/v4";

// TODO: handle redirect for when JS hasn't loaded yet

const subscribeSchema = z.object({
  email: z.email("Please enter a valid email address"),
  variantHandle: z.string("Variant handle is required"),
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
    variantHandle: form.get("variant-handle"),
  });

  if (!validationResult.success) {
    const firstError = validationResult.error.issues[0];
    return data({ error: firstError.message, success: false }, { status: 400 });
  }

  const { email, variantHandle } = validationResult.data;
  const tags = [`${variantHandle}-subscriber`, "out-of-stock-subscriber"];

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

    return data(
      {
        success: true,
        message: "We got you\nYou'll know",
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Subscribe action error:", error);

    return data(
      {
        error: error.message || "Something went wrong. Please try again.",
        success: false,
      },
      { status: 500 },
    );
  }
}
