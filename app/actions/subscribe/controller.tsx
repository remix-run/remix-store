import { createController } from "remix/router";
import type { RemixNode, SerializableObject } from "remix/ui";

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
  isSubscriptionValidationError,
  parseSubscriptionForm,
} from "../../data/subscription.ts";
import { verifyBackInStockSubscription } from "../../data/storefront.ts";
import { marketPath, type ActiveMarket } from "../../lib/public/market.ts";
import { getRuntime } from "../../runtime.ts";
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
        return render(
          <SubscribePage
            action={marketPath(
              routes.subscribe.action.href(),
              market.pathPrefix,
            )}
            canonicalUrl={
              url.origin +
              marketPath(routes.subscribe.index.href(), market.pathPrefix)
            }
          />,
        );
      },
      async action({ market, render, request, storefrontClient, url }) {
        let headers = new Headers({ "Cache-Control": "private, no-store" });
        let respond = (
          body: SubscriptionBody,
          status: number,
          successRedirect?: string,
        ) =>
          subscriptionResponse(request, url, render, market, {
            body,
            headers,
            status,
            successRedirect,
          });

        if (!isSameOriginRequest(request, url)) {
          return respond(
            { error: "Invalid request origin.", success: false },
            403,
          );
        }

        let parsed: ReturnType<typeof parseSubscriptionForm>;
        try {
          parsed = parseSubscriptionForm(await readBoundedForm(request));
        } catch {
          return respond(
            { error: "Invalid form submission.", success: false },
            400,
          );
        }
        if (isSubscriptionValidationError(parsed)) {
          return respond({ error: parsed.message, success: false }, 400);
        }

        let runtime = getRuntime(request);
        if (!runtime.buyerIp) {
          console.error("[subscribe] Trusted buyer IP unavailable");
          return respond(
            {
              error: "Something went wrong. Please try again.",
              success: false,
            },
            503,
          );
        }
        let [ipKey, emailKey] = await rateLimitKeys(
          runtime.buyerIp,
          parsed.email,
        );
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
        if (parsed.productHandle && parsed.variantId) {
          let verified = await verifyBackInStockSubscription(
            storefrontClient,
            parsed.productHandle,
            parsed.variantId,
          );
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
            parsed.variantId,
          );
          message = "Thanks! We’ll let you know when it’s back in stock.";
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
            consentUpdatedAt: (
              options.now ?? (() => new Date())
            )().toISOString(),
            email: parsed.email,
            tags,
          });
        } catch (error) {
          if (request.signal.aborted && error === request.signal.reason)
            throw error;
          // Keep Admin details and customer data out of logs and responses.
          console.error("[subscribe] Shopify Admin subscription failed");
          return respond(
            {
              error: "Something went wrong. Please try again.",
              success: false,
            },
            502,
          );
        }

        return respond(
          { message, success: true },
          200,
          parsed.productHandle
            ? marketPath("/collections/all", market.pathPrefix)
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

async function readBoundedForm(request: Request): Promise<FormData> {
  let contentType = request.headers
    .get("Content-Type")
    ?.split(";", 1)[0]
    ?.trim();
  if (contentType !== "application/x-www-form-urlencoded") {
    throw new TypeError("Unsupported subscription form content type");
  }
  let declaredLength = Number(request.headers.get("Content-Length"));
  if (declaredLength > 4096)
    throw new TypeError("Subscription form is too large");

  let reader = request.body?.getReader();
  let chunks: Uint8Array[] = [];
  let total = 0;
  if (reader) {
    while (true) {
      let { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      if (total > 4096) {
        await reader.cancel();
        throw new TypeError("Subscription form is too large");
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

function subscriptionResponse(
  request: Request,
  url: URL,
  render: (node: RemixNode, init?: ResponseInit) => Response,
  market: ActiveMarket,
  init: {
    body: SubscriptionBody;
    headers: Headers;
    status: number;
    successRedirect?: string;
  },
): Response {
  if (request.headers.get("Accept")?.includes("application/json")) {
    return Response.json(init.body, {
      status: init.status,
      headers: init.headers,
    });
  }
  if (init.body.success && init.successRedirect) {
    let headers = new Headers(init.headers);
    headers.set("Location", init.successRedirect);
    return new Response(null, { status: 303, headers });
  }
  return render(
    <SubscribePage
      action={marketPath(routes.subscribe.action.href(), market.pathPrefix)}
      canonicalUrl={
        url.origin +
        marketPath(routes.subscribe.index.href(), market.pathPrefix)
      }
      result={init.body}
    />,
    { status: init.status, headers: init.headers },
  );
}
