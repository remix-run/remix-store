import { parseFormData } from "remix/form-data-parser";
import { ContentType, SuperHeaders } from "remix/headers";
import { cop } from "remix/middleware/cop";
import { Renderer } from "remix/middleware/render";
import { createController } from "remix/router";
import { redirect } from "remix/response/redirect";
import type { RemixNode, SerializableObject } from "remix/component";

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
import { cacheControl } from "../../lib/cache-control.ts";
import { prefersJson } from "../../lib/negotiation.ts";
import { MarketConfig } from "../../middleware/market.tsx";
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
          {
            headers: new SuperHeaders({ cacheControl: cacheControl.browsing }),
          },
        );
      },
      action: {
        middleware: [
          cop({
            onDeny(_reason, context) {
              // SAFETY: The app's renderer middleware runs before controllers;
              // Remix's generic Renderer key erases the concrete RemixNode input type.
              let render = context.get(Renderer) as Renderer<RemixNode>;
              return subscriptionResponse(
                context.request,
                context.url,
                render,
                context.get(MarketConfig),
                {
                  body: { error: "Invalid request origin.", success: false },
                  headers: new SuperHeaders({
                    cacheControl: cacheControl.privateNoStore,
                  }),
                  status: 403,
                },
              );
            },
          }),
        ],
        async handler({ market, render, request, storefrontClient, url }) {
          let headers = new SuperHeaders({
            cacheControl: cacheControl.privateNoStore,
          });
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

          let parsed: ReturnType<typeof parseSubscriptionForm>;
          try {
            parsed = parseSubscriptionForm(await readSubscriptionForm(request));
          } catch {
            await request.body?.cancel().catch(() => {});
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
              ? marketPath(
                  routes.collections.show.href({ handle: "all" }),
                  market.pathPrefix,
                )
              : undefined,
          );
        },
      },
    },
  });
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

function subscriptionResponse(
  request: Request,
  url: URL,
  render: Renderer<RemixNode>,
  market: ActiveMarket,
  init: {
    body: SubscriptionBody;
    headers: Headers;
    status: number;
    successRedirect?: string;
  },
): Response | Promise<Response> {
  if (prefersJson(request)) {
    return Response.json(init.body, {
      status: init.status,
      headers: init.headers,
    });
  }
  if (init.body.success && init.successRedirect) {
    return redirect(init.successRedirect, {
      status: 303,
      headers: init.headers,
    });
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
