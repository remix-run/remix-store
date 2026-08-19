import * as assert from "remix/assert";
import * as s from "remix/data-schema";
import { describe, it } from "remix/test";

import type { RateLimiter } from "../../data/rate-limit.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
  type StorefrontJsonObject,
  type StorefrontRequestBody,
} from "../../testing/storefront.ts";

const shellHandlers = {
  RemixAnalyticsShop: analyticsShopData,
  RemixNavigation: navigationData,
};

describe("subscribe routes", () => {
  it("renders an explicit-consent native newsletter form", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers));
    let response = await app.fetch(
      new Request("https://example.com/subscribe"),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(html, /<title>Subscribe \| The Remix Store<\/title>/);
    assert.match(html, /action="\/subscribe" method="post"/);
    assert.match(html, /type="email" name="email"/);
    assert.match(html, /Enter your email below to subscribe\./);
    assert.match(html, /type="hidden" name="consent" value="yes"/);
    assert.doesNotMatch(html, /type="checkbox" name="consent"/);
  });

  it("rejects invalid email, consent, origin, and rate limits before Admin", async () => {
    let adminCalls = 0;
    let denied: RateLimiter = {
      consumeMany: async () => ({ allowed: false, retryAfterSeconds: 42 }),
    };
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: {
        adminFetch: async () => {
          adminCalls += 1;
          throw new Error("must not call Admin");
        },
        rateLimiter: denied,
      },
    });

    let invalidEmail = await post(app, { consent: "yes", email: "not-email" });
    assert.equal(invalidEmail.status, 400);
    assert.match(await invalidEmail.text(), /valid email/);

    let missingConsent = await post(app, { email: "member@example.com" });
    assert.equal(missingConsent.status, 400);
    assert.match(await missingConsent.text(), /agree to receive emails/);

    let wrongOrigin = await post(
      app,
      { consent: "yes", email: "member@example.com" },
      { Origin: "https://attacker.example" },
    );
    assert.equal(wrongOrigin.status, 403);

    let limited = await post(app, {
      consent: "yes",
      email: "member@example.com",
    });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("Retry-After"), "42");
    assert.equal(adminCalls, 0);
  });

  it("returns a controlled 503 without Storefront or Admin when trusted IP is missing", async (t) => {
    let storefrontCalls = 0;
    let adminCalls = 0;
    let logs: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
    let app = createTestApp(
      async () => {
        storefrontCalls += 1;
        throw new Error("must not call Storefront");
      },
      {
        buyerIp: undefined,
        subscribe: {
          adminFetch: async () => {
            adminCalls += 1;
            throw new Error("must not call Admin");
          },
          rateLimiter: allowAll(),
        },
      },
    );

    let response = await post(app, {
      consent: "yes",
      email: "member@example.com",
    });
    let body = await response.text();

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(body, /Something went wrong/);
    assert.doesNotMatch(body, /member@example\.com/);
    assert.equal(storefrontCalls, 0);
    assert.equal(adminCalls, 0);
    assert.doesNotMatch(JSON.stringify(logs), /member@example\.com/);

    let htmlRequest = formRequest({
      consent: "yes",
      email: "member@example.com",
    });
    htmlRequest.headers.delete("Accept");
    let htmlResponse = await app.fetch(htmlRequest);
    let html = await htmlResponse.text();
    assert.equal(htmlResponse.status, 503);
    assert.match(htmlResponse.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Something went wrong/);
    assert.doesNotMatch(html, /member@example\.com/);
    assert.equal(storefrontCalls, 0);
    assert.equal(adminCalls, 0);
  });

  it("rejects oversized and unexpected form bodies before Admin", async () => {
    let adminCalls = 0;
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: {
        adminFetch: async () => {
          adminCalls += 1;
          throw new Error("must not call Admin");
        },
        rateLimiter: allowAll(),
      },
    });
    let oversized = await app.fetch(
      new Request("https://example.com/subscribe", {
        method: "POST",
        headers: {
          Origin: "https://example.com",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `email=${"a".repeat(5000)}`,
      }),
    );
    assert.equal(oversized.status, 400);

    let unexpected = await post(app, {
      consent: "yes",
      email: "member@example.com",
      tags: "browser-controlled",
    });
    assert.equal(unexpected.status, 400);
    assert.equal(adminCalls, 0);
  });

  it("renders validation errors as HTML without JavaScript", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: { rateLimiter: allowAll() },
    });
    let request = formRequest({ email: "member@example.com" });
    request.headers.delete("Accept");
    let response = await app.fetch(request);
    let html = await response.text();
    assert.equal(response.status, 400);
    assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(html, /role="alert"/);
    assert.match(html, /agree to receive emails/);
  });

  it("subscribes a newsletter customer and renders confirmation without JavaScript", async () => {
    let bodies: AdminBody[] = [];
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: {
        adminFetch: adminFetch(bodies),
        now: () => new Date("2026-07-30T12:00:00.000Z"),
        rateLimiter: allowAll(),
      },
    });
    let request = formRequest({
      consent: "yes",
      email: "member@example.com",
    });
    request.headers.delete("Accept");
    request.headers.set("Referer", "https://example.com/subscribe");
    request.headers.delete("Origin");
    let response = await app.fetch(request);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(await response.text(), /Thanks for subscribing/);
    assert.equal(bodies.length, 2);
    assert.deepEqual(adminInputTags(bodies[1]!), []);
  });

  it("verifies product state and derives back-in-stock tags server-side", async () => {
    let bodies: AdminBody[] = [];
    let storefrontFetch = createStorefrontFetch({
      ...shellHandlers,
      RemixBackInStockSubscription: () => ({
        node: {
          availableForSale: false,
          id: "gid://shopify/ProductVariant/222",
          product: {
            handle: "test-product",
            subscribeIfBackInStock: { value: "true" },
          },
          title: "Blue / Large",
        },
      }),
    });
    let app = createTestApp(storefrontFetch, {
      subscribe: {
        adminFetch: adminFetch(bodies),
        rateLimiter: allowAll(),
      },
    });
    let response = await post(app, {
      consent: "yes",
      email: "member@example.com",
      "product-handle": "test-product",
      // No title or tags are accepted from the browser.
      "variant-id": "gid://shopify/ProductVariant/222",
    });

    assert.equal(response.status, 200);
    assert.match(await response.text(), /back in stock/);
    assert.deepEqual(adminInputTags(bodies[1]!), [
      "back-in-stock-subscriber",
      "test-product-blue-large-back-in-stock-subscriber",
    ]);
  });

  it("rejects high-risk variant mismatches before Admin", async () => {
    let cases = [
      {
        name: "available variant",
        node: verifiedVariant({ availableForSale: true }),
      },
      {
        name: "mismatched variant id",
        node: verifiedVariant({ id: "gid://shopify/ProductVariant/999" }),
      },
      {
        name: "mismatched product handle",
        node: verifiedVariant({
          product: {
            handle: "other-product",
            subscribeIfBackInStock: { value: "true" },
          },
        }),
      },
      {
        name: "disabled subscription metafield",
        node: verifiedVariant({
          product: {
            handle: "test-product",
            subscribeIfBackInStock: { value: "false" },
          },
        }),
      },
      { name: "missing variant", node: null },
    ];

    for (let testCase of cases) {
      let adminCalls = 0;
      let storefrontFetch = createStorefrontFetch({
        ...shellHandlers,
        RemixBackInStockSubscription: () => ({ node: testCase.node }),
      });
      let app = createTestApp(storefrontFetch, {
        subscribe: {
          adminFetch: async () => {
            adminCalls += 1;
            throw new Error("must not call Admin");
          },
          rateLimiter: allowAll(),
        },
      });
      let response = await post(app, {
        consent: "yes",
        email: "member@example.com",
        "product-handle": "test-product",
        "variant-id": "gid://shopify/ProductVariant/222",
      });

      assert.equal(response.status, 400, testCase.name);
      assert.match(await response.text(), /not available for notifications/);
      assert.equal(adminCalls, 0, testCase.name);
    }
  });

  it("redirects a successful no-JavaScript back-in-stock submission", async () => {
    let storefrontFetch = createStorefrontFetch({
      ...shellHandlers,
      RemixBackInStockSubscription: () => ({
        node: {
          availableForSale: false,
          id: "gid://shopify/ProductVariant/222",
          product: {
            handle: "test-product",
            subscribeIfBackInStock: { value: "true" },
          },
          title: "Blue",
        },
      }),
    });
    let app = createTestApp(storefrontFetch, {
      subscribe: { adminFetch: adminFetch([]), rateLimiter: allowAll() },
    });
    let request = formRequest({
      consent: "yes",
      email: "member@example.com",
      "product-handle": "test-product",
      "variant-id": "gid://shopify/ProductVariant/222",
    });
    request.headers.delete("Accept");
    let response = await app.fetch(request);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/collections/all");
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("keeps localized no-JavaScript back-in-stock redirects in Canada", async () => {
    let variables: StorefrontRequestBody["variables"] | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        ...shellHandlers,
        RemixBackInStockSubscription(body) {
          variables = body.variables;
          return {
            node: {
              availableForSale: false,
              id: "gid://shopify/ProductVariant/222",
              product: {
                handle: "test-product",
                subscribeIfBackInStock: { value: "true" },
              },
              title: "Blue",
            },
          };
        },
      }),
      {
        subscribe: { adminFetch: adminFetch([]), rateLimiter: allowAll() },
      },
    );
    let request = formRequest({
      consent: "yes",
      email: "member@example.com",
      "product-handle": "test-product",
      "variant-id": "gid://shopify/ProductVariant/222",
    });
    request = new Request(
      request.url.replace("/subscribe", "/en-ca/subscribe"),
      request,
    );
    request.headers.delete("Accept");

    let response = await app.fetch(request);
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("Location"), "/en-ca/collections/all");
    assert.equal(variables?.country, "CA");
    assert.equal(variables?.language, "EN");
  });

  it("returns a generic Admin failure without logging the email or response", async (t) => {
    let logs: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: {
        adminFetch: async () =>
          new Response(
            JSON.stringify({
              errors: [{ message: "customer member@example.com" }],
            }),
          ),
        rateLimiter: allowAll(),
      },
    });

    let response = await post(app, {
      consent: "yes",
      email: "member@example.com",
    });
    let body = await response.text();
    assert.equal(response.status, 502);
    assert.match(body, /Something went wrong/);
    assert.doesNotMatch(body, /member@example\.com|customer/);
    assert.doesNotMatch(JSON.stringify(logs), /member@example\.com|customer/);
  });
});

interface VerifiedVariantFixture extends StorefrontJsonObject {
  availableForSale: boolean;
  id: string;
  product: {
    handle: string;
    subscribeIfBackInStock: { value: string };
  };
  title: string;
}

function verifiedVariant(
  overrides: Partial<VerifiedVariantFixture> = {},
): VerifiedVariantFixture {
  return {
    availableForSale: false,
    id: "gid://shopify/ProductVariant/222",
    product: {
      handle: "test-product",
      subscribeIfBackInStock: { value: "true" },
    },
    title: "Blue",
    ...overrides,
  };
}

function post(
  app: ReturnType<typeof createTestApp>,
  fields: Record<string, string>,
  headers?: HeadersInit,
) {
  return app.fetch(formRequest(fields, headers));
}

function formRequest(fields: Record<string, string>, headers?: HeadersInit) {
  return new Request("https://example.com/subscribe", {
    method: "POST",
    headers: {
      Accept: "application/json",
      Origin: "https://example.com",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

function allowAll(): RateLimiter {
  return {
    consumeMany: async () => ({ allowed: true, retryAfterSeconds: 0 }),
  };
}

const AdminBodySchema = s.object({
  query: s.string(),
  variables: s.record(s.string(), s.any()),
});

const AdminInputTagsSchema = s.object({
  input: s.object({ tags: s.array(s.string()) }),
});

type AdminBody = s.InferOutput<typeof AdminBodySchema>;

function adminFetch(bodies: AdminBody[]): typeof globalThis.fetch {
  return async (_input, init) => {
    let body = parseAdminBody(init?.body);
    bodies.push(body);
    if (body.query.includes("RemixCustomerByEmail")) {
      return adminResponse({ customerByIdentifier: null });
    }
    return adminResponse({
      customerCreate: { customer: { id: "customer-1" }, userErrors: [] },
    });
  };
}

function adminResponse(data: StorefrontJsonObject) {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}

function parseAdminBody(body: BodyInit | null | undefined): AdminBody {
  return s.parse(AdminBodySchema, JSON.parse(String(body)));
}

function adminInputTags(body: AdminBody): string[] {
  return s.parse(AdminInputTagsSchema, body.variables).input.tags;
}
