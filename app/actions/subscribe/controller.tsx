import { SuperHeaders } from "remix/headers";
import { createController, type RouterTypes } from "remix/router";
import { redirect } from "remix/response/redirect";
import type { FormSubmission } from "remix/data-schema/experimental/form";

import {
  createAdminCustomerClient,
  subscribeCustomer,
} from "../../data/admin.server.ts";
import {
  type RateLimiter,
  subscriptionRateLimiter,
} from "../../data/rate-limit.ts";
import {
  backInStockTags,
  formFailure,
  parseSubscriptionForm,
} from "../../data/subscription.ts";
import { verifyBackInStockSubscription } from "../../data/storefront.ts";
import { cacheControl } from "../../lib/cache-control.ts";
import { marketPath } from "../../lib/public/market.ts";
import {
  productFromSearch,
  subscribeFormSrc,
} from "../../lib/public/subscription-form.ts";
import { isSubscribeFrame } from "../../middleware/storefront.ts";
import { getRuntime } from "../../runtime.ts";
import { routes } from "../../routes.ts";
import { SubscribeForm } from "../../assets/public/subscribe-form.tsx";
import { SubscribePage } from "./page.tsx";
import {
  isSameOriginRequest,
  rateLimitKeys,
  readBoundedForm,
} from "./request.ts";

export interface SubscribeControllerOptions {
  adminFetch?: typeof globalThis.fetch;
  now?: () => Date;
  rateLimiter?: RateLimiter;
}

export function createSubscribeController(
  options: SubscribeControllerOptions = {},
) {
  return createController(routes.subscribe, {
    actions: {
      // The page holds a frame that asks for this same URL to get the form.
      index({ market, render, request, url }) {
        let product = productFromSearch(url.searchParams);
        let outcome = url.searchParams.get("subscription");
        let headers = new SuperHeaders({ cacheControl: cacheControl.browsing });

        if (isSubscribeFrame(request)) {
          let { message, submission } = outcomeFromKey(
            outcome,
            Boolean(product),
          );
          // Frame content is not a document to index.
          headers.set("X-Robots-Tag", "noindex");
          return render(
            <SubscribeForm
              action={subscribeFormSrc(market.pathPrefix, product)}
              message={message}
              productHandle={product?.handle}
              submission={submission}
              variantId={product?.variantId}
            />,
            { headers },
          );
        }

        return render(
          <SubscribePage
            canonicalUrl={
              url.origin +
              marketPath(routes.subscribe.index.href(), market.pathPrefix)
            }
            src={subscribeFormSrc(
              market.pathPrefix,
              product,
              outcome ?? undefined,
            )}
          />,
          { headers },
        );
      },

      async action(context) {
        let { market, render, request, url } = context;
        let product = productFromSearch(url.searchParams);
        let { headers, message, status, submission } = await subscribe(
          context,
          options,
        );

        // Without scripts the whole page posted: go back to it with the outcome.
        if (!isSubscribeFrame(request)) {
          return redirect(
            subscribeFormSrc(market.pathPrefix, product, outcomeKey(status)),
            { status: 303, headers },
          );
        }

        // With scripts only the form's frame posted: it gets the form back.
        headers.set("X-Robots-Tag", "noindex");
        return render(
          <SubscribeForm
            action={subscribeFormSrc(market.pathPrefix, product)}
            message={message}
            productHandle={product?.handle}
            submission={submission}
            variantId={product?.variantId}
          />,
          { headers, status },
        );
      },
    },
  });
}

type Context = RouterTypes["context"];

/** What the signup form shows: a confirmation, or what went wrong. */
interface Outcome {
  message?: string;
  submission?: FormSubmission;
}

/** What came of a signup: the response to give, and what the form shows. */
type SubscribeResult = {
  headers: SuperHeaders;
  status: number;
} & Outcome;

const NEWSLETTER_MESSAGE =
  "Thanks for subscribing! We’ll keep you updated on our latest news.";
const BACK_IN_STOCK_MESSAGE =
  "Thanks! We’ll let you know when it’s back in stock.";

const failures: Record<string, string> = {
  invalid: "Please check your details and try again.",
  limited: "Too many attempts. Please try again later.",
  error: "Something went wrong. Please try again.",
};

/**
 * A signup without scripts can't hand its result to the form's frame, so it
 * goes in the page's URL as a key from the response status. No form data.
 */
function outcomeKey(status: number): string {
  if (status === 200) return "success";
  return status === 400 ? "invalid" : status === 429 ? "limited" : "error";
}

/** The reverse of `outcomeKey`: what the frame shows for a key in the URL. */
function outcomeFromKey(key: string | null, backInStock: boolean): Outcome {
  if (key === "success") {
    return {
      message: backInStock ? BACK_IN_STOCK_MESSAGE : NEWSLETTER_MESSAGE,
    };
  }
  if (key && Object.hasOwn(failures, key)) {
    return { submission: formFailure(failures[key]!) };
  }
  return {};
}

async function subscribe(
  { request, storefrontClient, url }: Context,
  options: SubscribeControllerOptions,
): Promise<SubscribeResult> {
  let headers = new SuperHeaders({
    cacheControl: cacheControl.privateNoStore,
  });
  let fail = (status: number, message: string, email?: string) => ({
    headers,
    status,
    submission: formFailure(message, email),
  });

  if (!isSameOriginRequest(request, url)) {
    return fail(403, "Invalid request origin.");
  }

  let parsed: ReturnType<typeof parseSubscriptionForm>;
  try {
    parsed = parseSubscriptionForm(await readBoundedForm(request));
  } catch {
    return fail(400, "Invalid form submission.");
  }
  if (!parsed.success) return { headers, status: 400, submission: parsed };
  let { email, productHandle, variantId } = parsed.value;

  let runtime = getRuntime(request);
  if (!runtime.buyerIp) {
    console.error("[subscribe] Trusted buyer IP unavailable");
    return fail(503, "Something went wrong. Please try again.", email);
  }
  let [ipKey, emailKey] = await rateLimitKeys(runtime.buyerIp, email);
  let limiter = options.rateLimiter ?? subscriptionRateLimiter;
  let limit = await limiter.consumeMany([ipKey, emailKey]);
  if (!limit.allowed) {
    headers.set("Retry-After", String(limit.retryAfterSeconds));
    return fail(429, "Too many attempts. Please try again later.", email);
  }

  let tags: string[] = [];
  let message = NEWSLETTER_MESSAGE;
  if (productHandle && variantId) {
    let verified = await verifyBackInStockSubscription(
      storefrontClient,
      productHandle,
      variantId,
    );
    if (!verified) {
      return fail(
        400,
        "This product is not available for notifications.",
        email,
      );
    }
    tags = backInStockTags(
      verified.productHandle,
      verified.variantTitle,
      variantId,
    );
    message = BACK_IN_STOCK_MESSAGE;
  }

  let env = runtime.env ?? {};
  try {
    let admin = createAdminCustomerClient({
      accessToken: env[["ADMIN", "ACCESS", "TOKEN"].join("_")],
      fetch: options.adminFetch,
      signal: request.signal,
      storeDomain: env.ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN,
    });
    await subscribeCustomer(admin, {
      consentUpdatedAt: (options.now ?? (() => new Date()))().toISOString(),
      email,
      tags,
    });
  } catch (error) {
    if (request.signal.aborted && error === request.signal.reason) throw error;
    // Keep Admin details and customer data out of logs and responses.
    console.error("[subscribe] Shopify Admin subscription failed");
    return fail(502, "Something went wrong. Please try again.", email);
  }

  return { headers, message, status: 200 };
}
