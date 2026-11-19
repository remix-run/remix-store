import { Frame, type RemixNode } from "remix/component";
import type { FormSubmission } from "remix/data-schema/experimental/form";
import { parseFormData } from "remix/form-data-parser";
import { ContentType, SuperHeaders } from "remix/headers";
import { cop } from "remix/middleware/cop";
import { Renderer } from "remix/middleware/render";
import {
  createController,
  type RequestContext,
  type RouterTypes,
} from "remix/router";
import { redirect } from "remix/response/redirect";

import { SubscribeForm } from "../../assets/public/subscribe-form.tsx";
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
import { marketPath, type ActiveMarket } from "../../lib/public/market.ts";
import {
  isSubscribed,
  productFromSearch,
  SUBSCRIBE_FRAME,
  SUBSCRIBED_PARAM,
  subscribeFormSrc,
  type SubscriptionProduct,
} from "../../lib/public/subscription.ts";
import { MarketConfig } from "../../middleware/market.tsx";
import { isSubscribeFrame } from "../../middleware/storefront.ts";
import { getRuntime } from "../../runtime.ts";
import { routes } from "../../routes.ts";
import { SubscribePage } from "./page.tsx";

export interface SubscribeControllerOptions {
  adminFetch?: typeof globalThis.fetch;
  now?: () => Date;
  rateLimiter?: RateLimiter;
}

const NEWSLETTER_MESSAGE =
  "Thanks for subscribing! We’ll keep you updated on our latest news.";
const BACK_IN_STOCK_MESSAGE =
  "Thanks! We’ll let you know when it’s back in stock.";
const FAILED_MESSAGE = "Something went wrong. Please try again.";

/** What came of a signup: the response to give, and what the form shows. */
interface SubscribeResult {
  headers: SuperHeaders;
  status: number;
  /** The confirmation, when the signup succeeded. */
  message?: string;
  /** Where a back-in-stock signup without JavaScript returns. */
  productUrl?: string;
  submission?: FormSubmission;
}

export function createSubscribeController(
  options: SubscribeControllerOptions = {},
) {
  return createController(routes.subscribe, {
    actions: {
      // The page holds a frame that asks this same URL for the form alone.
      index({ market, render, request, url }) {
        let product = productFromSearch(url.searchParams);
        let headers = new SuperHeaders({ cacheControl: cacheControl.browsing });
        let action = subscribeFormSrc(market.pathPrefix, product);

        if (isSubscribeFrame(request)) {
          // Frame content is not a document to index.
          headers.xRobotsTag = "noindex";
          let subscribed =
            product && isSubscribed(url.searchParams, product.variantId);
          return render(
            <SubscribeForm
              action={action}
              message={subscribed ? BACK_IN_STOCK_MESSAGE : undefined}
              product={product}
            />,
            { headers },
          );
        }

        return render(
          subscribePage(
            url,
            market,
            product,
            <Frame name={SUBSCRIBE_FRAME} src={action} />,
          ),
          { headers },
        );
      },
      action: {
        middleware: [
          cop({
            onDeny(_reason, context) {
              let headers = new SuperHeaders({
                cacheControl: cacheControl.privateNoStore,
              });
              return respond(context, {
                headers,
                status: 403,
                submission: formFailure("Invalid request origin."),
              });
            },
          }),
        ],
        async handler(context) {
          return respond(context, await subscribe(context, options));
        },
      },
    },
  });
}

/**
 * Answers a signup. Its frame gets the form back, showing what happened.
 * Without JavaScript the whole page posted: it gets the page with the form,
 * or a back-in-stock signup returns to its product.
 */
function respond(
  context: RequestContext<any, any>,
  result: SubscribeResult,
): Response | Promise<Response> {
  let { request, url } = context;
  // SAFETY: The app's renderer middleware runs before controllers; Remix's
  // generic Renderer key erases the concrete RemixNode input type.
  let render = context.get(Renderer) as Renderer<RemixNode>;
  let market = context.get(MarketConfig);
  let { headers, message, productUrl, status, submission } = result;
  let product = productFromSearch(url.searchParams);
  let form = (
    <SubscribeForm
      action={subscribeFormSrc(market.pathPrefix, product)}
      message={message}
      product={product}
      submission={submission}
    />
  );

  if (isSubscribeFrame(request)) {
    headers.xRobotsTag = "noindex";
    return render(form, { headers, status });
  }
  if (productUrl) return redirect(productUrl, { headers, status: 303 });
  return render(subscribePage(url, market, product, form), {
    headers,
    status,
  });
}

function subscribePage(
  url: URL,
  market: ActiveMarket,
  product: SubscriptionProduct | undefined,
  form: RemixNode,
) {
  return (
    <SubscribePage
      backInStock={Boolean(product)}
      canonicalUrl={
        url.origin +
        marketPath(routes.subscribe.index.href(), market.pathPrefix)
      }
      productHref={
        product
          ? marketPath(
              routes.products.show.href({ handle: product.handle }),
              market.pathPrefix,
            )
          : undefined
      }
    >
      {form}
    </SubscribePage>
  );
}

async function subscribe(
  context: RouterTypes["context"],
  options: SubscribeControllerOptions,
): Promise<SubscribeResult> {
  let { market, request } = context;
  let headers = new SuperHeaders({
    cacheControl: cacheControl.privateNoStore,
  });
  let fail = (status: number, message: string, email?: string) => ({
    headers,
    status,
    submission: formFailure(message, email),
  });

  let parsed: ReturnType<typeof parseSubscriptionForm>;
  try {
    parsed = parseSubscriptionForm(await readSubscriptionForm(request));
  } catch {
    await request.body?.cancel().catch(() => {});
    return fail(400, "Invalid form submission.");
  }
  if (!parsed.success) return { headers, status: 400, submission: parsed };
  let { email, productHandle, variantId } = parsed.value;

  let runtime = getRuntime(request);
  if (!runtime.buyerIp) {
    // Subscription abuse controls require an adapter-supplied, trusted IP.
    // Fail closed before Storefront and Admin work, without request data.
    console.error("[subscribe] Trusted buyer IP unavailable");
    return fail(503, FAILED_MESSAGE, email);
  }
  let [ipKey, emailKey] = await rateLimitKeys(runtime.buyerIp, email);
  let limiter = options.rateLimiter ?? subscriptionRateLimiter;
  let limit = await limiter.consumeMany([ipKey, emailKey]);
  if (!limit.allowed) {
    headers.retryAfter = String(limit.retryAfterSeconds);
    return fail(429, "Too many attempts. Please try again later.", email);
  }

  let tags: string[] = [];
  let message = NEWSLETTER_MESSAGE;
  let productUrl: string | undefined;
  if (productHandle && variantId) {
    let verified = await verifyBackInStockSubscription(
      context.storefrontClient,
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
    let search = new URLSearchParams(
      verified.selectedOptions
        // Single-variant products have no options to put in the URL.
        .filter(({ value }) => value !== "Default Title")
        .map(({ name, value }) => [name, value]),
    );
    search.set(SUBSCRIBED_PARAM, variantId);
    productUrl = `${marketPath(
      routes.products.show.href({ handle: verified.productHandle }),
      market.pathPrefix,
    )}?${search}`;
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
    return fail(502, FAILED_MESSAGE, email);
  }

  return {
    headers,
    status: 200,
    message,
    productUrl,
    // Keeps the subscribed email in the form alongside the confirmation.
    submission: { values: { email }, errors: { fields: {} } },
  };
}

async function readSubscriptionForm(request: Request): Promise<FormData> {
  let { mediaType } = ContentType.from(request.headers.get("Content-Type"));
  if (mediaType !== "application/x-www-form-urlencoded") {
    throw new TypeError("Unsupported subscription form content type");
  }
  return parseFormData(request, { maxTotalSize: 4096 });
}

async function rateLimitKeys(
  buyerIp: string,
  email: string,
): Promise<[string, string]> {
  return Promise.all([
    oneWayDigest(`ip:${buyerIp}`),
    oneWayDigest(`email:${email}`),
  ]);
}

async function oneWayDigest(value: string): Promise<string> {
  let digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
