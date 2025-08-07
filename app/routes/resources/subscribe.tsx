import { data, redirect } from "react-router";
import type { Route } from "./+types/subscribe";
import { ShopifyCustomer } from "~/lib/data/subscribe.server";
import * as z from "zod";

const subscribeSchema = z.object({
  email: z.email("Please enter a valid email address."),
  variantHandle: z.string("Variant handle is required."),
  variantTitle: z.string("Variant title is required."),
  redirect: z.string().nullish(),
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
    variantTitle: form.get("variant-title"),
    redirect: form.get("redirect"),
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
    redirect: redirectUrl,
  } = validationResult.data;

  variantTitle = variantTitle.toLowerCase().replace(/ /g, "-");

  const tags = [
    `back-in-stock-subscriber`,
    `${variantHandle}-${variantTitle}-back-in-stock-subscriber`,
  ];

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

    // If redirect URL exists, redirect after success (JS not loaded)
    if (redirectUrl) {
      return redirect(redirectUrl);
    }

    // Otherwise, return data for hydrated form (JS loaded)
    return data(
      {
        success: true,
        message:
          "Thanks for subscribing! We'll let you know when it's back in stock.",
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
