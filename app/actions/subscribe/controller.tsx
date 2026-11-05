import { SuperHeaders } from "remix/headers";
import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import type { SerializableObject } from "remix/component";

import {
  AdminApiError,
  createAdminCustomerClient,
  subscribeCustomer,
} from "../../data/admin.ts";
import {
  type RateLimiter,
  subscriptionRateLimiter,
} from "../../lib/rate-limit.ts";
import {
  backInStockTags,
  isSubscriptionValidationError,
  parseSubscriptionForm,
} from "../../data/subscription.ts";
import { queryBackInStockEligibleVariant } from "../../data/product.ts";
import { isStorefrontFailure } from "../../data/storefront.ts";
import { cacheControl } from "../../lib/cache-control.ts";
import {
  marketPath,
  marketUrl,
  type ActiveMarket,
} from "../../lib/public/market.ts";
import { routes } from "../../routes.ts";
import { SubscribePage } from "./page.tsx";

export interface SubscribeControllerOptions {
  adminFetch?: typeof globalThis.fetch;
  now?: () => Date;
  rateLimiter?: RateLimiter;
}

interface SubscriptionBody extends SerializableObject {
  error?: string;
  message?: string;
  success: boolean;
}

export function createSubscribeController(
  options: SubscribeControllerOptions = {},
) {
  return createController(routes.subscribe, {
    actions: {
      async index({ market, render, url }) {
        return render(subscribePage(url, market), {
          headers: new SuperHeaders({ cacheControl: cacheControl.browsing }),
        });
      },
      async action({
        buyerIp,
        env,
        market,
        render,
        request,
        storefrontClient,
        url,
      }) {
        let headers = new SuperHeaders({
          cacheControl: cacheControl.privateNoStore,
        });
        // JavaScript submissions get JSON. Without it, the form re-renders
        // the page with the result, or follows a redirect on success.
        let respond = (
          body: SubscriptionBody,
          status: number,
          successRedirect?: string,
        ) => {
          if (request.headers.get("Accept")?.includes("application/json")) {
            return Response.json(body, { status, headers });
          }
          if (body.success && successRedirect) {
            return redirect(successRedirect, { status: 303, headers });
          }
          return render(subscribePage(url, market, body), { status, headers });
        };

        if (!isSameOriginRequest(request, url)) {
          return respond(
            { error: "Invalid request origin.", success: false },
            403,
          );
        }

        let parsed: ReturnType<typeof parseSubscriptionForm>;
        try {
          parsed = parseSubscriptionForm(await readBoundedForm(request));
        } catch (error) {
          if (!(error instanceof InvalidSubscriptionFormError)) throw error;
          return respond(
            { error: "Invalid form submission.", success: false },
            400,
          );
        }
        if (isSubscriptionValidationError(parsed)) {
          return respond({ error: parsed.message, success: false }, 400);
        }

        let [ipKey, emailKey] = await rateLimitKeys(buyerIp, parsed.email);
        let limiter = options.rateLimiter ?? subscriptionRateLimiter;
        let limit = await limiter.consumeMany([ipKey, emailKey]);
        if (!limit.allowed) {
          headers.set("Retry-After", String(limit.retryAfterSeconds));
          return respond(
            {
              error: "Too many attempts. Please try again later.",
              success: false,
            },
            429,
          );
        }

        let tags: string[] = [];
        let message =
          "Thanks for subscribing! We’ll keep you updated on our latest news.";
        let { product } = parsed;
        if (product) {
          let verified;
          try {
            verified = await queryBackInStockEligibleVariant(
              storefrontClient,
              product.handle,
              product.variantId,
            );
          } catch (error) {
            if (!isStorefrontFailure(error)) throw error;
            console.error(
              "[subscribe] Back-in-stock variant lookup failed",
              error,
            );
            return respond(SUBSCRIPTION_FAILED, 502);
          }
          if (!verified) {
            return respond(
              {
                error: "This product is not available for notifications.",
                success: false,
              },
              400,
            );
          }
          tags = backInStockTags(
            verified.productHandle,
            verified.variantTitle,
            product.variantId,
          );
          message = "Thanks! We’ll let you know when it’s back in stock.";
        }

        try {
          let admin = createAdminCustomerClient({
            accessToken: env.ADMIN_ACCESS_TOKEN,
            fetch: options.adminFetch,
            signal: request.signal,
            storeDomain: env.ADMIN_STORE_DOMAIN ?? env.PUBLIC_STORE_DOMAIN,
          });
          await subscribeCustomer(admin, {
            consentUpdatedAt: (
              options.now ?? (() => new Date())
            )().toISOString(),
            email: parsed.email,
            tags,
          });
        } catch (error) {
          // Anything else, including aborts, reaches the error boundary.
          if (!(error instanceof AdminApiError)) throw error;
          // The code is safe to log; Admin responses may hold customer data.
          console.error(
            "[subscribe] Shopify Admin subscription failed:",
            error.code,
          );
          return respond(SUBSCRIPTION_FAILED, 502);
        }

        return respond(
          { message, success: true },
          200,
          product
            ? marketPath(
                routes.collections.show.href({ handle: "all" }),
                market.pathPrefix,
              )
            : undefined,
        );
      },
    },
  });
}

function isSameOriginRequest(request: Request, url: URL): boolean {
  let origin = request.headers.get("Origin");
  if (origin) return origin === url.origin;
  let referer = request.headers.get("Referer");
  if (!referer) return false;
  try {
    return new URL(referer).origin === url.origin;
  } catch {
    return false;
  }
}

const MAX_FORM_BYTES = 4096;

const SUBSCRIPTION_FAILED: SubscriptionBody = {
  error: "Something went wrong. Please try again.",
  success: false,
};

/** The submission is not a small urlencoded form. */
class InvalidSubscriptionFormError extends Error {
  override name = "InvalidSubscriptionFormError";
}

async function readBoundedForm(request: Request): Promise<FormData> {
  let contentType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new InvalidSubscriptionFormError(
      "Unsupported subscription form content type",
    );
  }
  let declaredLength = Number(request.headers.get("Content-Length"));
  if (declaredLength > MAX_FORM_BYTES)
    throw new InvalidSubscriptionFormError("Subscription form is too large");

  let reader = request.body?.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      let { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      if (total > MAX_FORM_BYTES) {
        await reader.cancel();
        throw new InvalidSubscriptionFormError(
          "Subscription form is too large",
        );
      }
      chunks.push(value);
    }
  }
  let bytes = new Uint8Array(total);
  let offset = 0;
  for (let chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let form = new FormData();
  for (let [name, value] of new URLSearchParams(
    new TextDecoder().decode(bytes),
  )) {
    form.append(name, value);
  }
  return form;
}

function rateLimitKeys(
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

function subscribePage(
  url: URL,
  market: ActiveMarket,
  result?: SubscriptionBody,
) {
  return (
    <SubscribePage
      action={marketPath(routes.subscribe.action.href(), market.pathPrefix)}
      canonicalUrl={marketUrl(
        url,
        routes.subscribe.index.href(),
        market.pathPrefix,
      )}
      result={result}
    />
  );
}
