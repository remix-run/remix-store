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
    assert.match(html, /<input type="email"[^>]* name="email" required/);
    assert.match(html, /Enter your email below to subscribe\./);
    assert.match(html, /<input type="hidden" value="yes"[^>]* name="consent"/);
    assert.doesNotMatch(html, /type="checkbox"/);
  });

  it("serves the form alone to its frame", async () => {
    let app = createTestApp(createStorefrontFetch({}));

    let response = await app.fetch(
      frameRequest("https://example.com/en-ca/subscribe"),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-Robots-Tag"), "noindex");
    assert.doesNotMatch(html, /<html|<title>/);
    assert.match(html, /<form action="\/en-ca\/subscribe" method="post"/);
  });

  it("confirms a back-in-stock signup in its frame from the subscribed flag", async () => {
    let app = createTestApp(createStorefrontFetch({}));
    let src =
      "https://example.com/subscribe?product-handle=test-product&variant-id=gid%3A%2F%2Fshopify%2FProductVariant%2F222";

    let confirmed = await (
      await app.fetch(
        frameRequest(
          `${src}&subscribed=gid%3A%2F%2Fshopify%2FProductVariant%2F222`,
        ),
      )
    ).text();
    let otherVariant = await (
      await app.fetch(
        frameRequest(
          `${src}&subscribed=gid%3A%2F%2Fshopify%2FProductVariant%2F999`,
        ),
      )
    ).text();

    assert.match(confirmed, /role="status"[^>]*>Thanks! We’ll let you know/);
    assert.match(confirmed, /<button type="submit" disabled/);
    assert.doesNotMatch(otherVariant, /Thanks!/);
    assert.match(otherVariant, /name="variant-id"/);
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
    assert.equal(wrongOrigin.headers.get("Cache-Control"), "private, no-store");
    assert.match(await wrongOrigin.text(), /Invalid request origin\./);

    let crossSite = await post(
      app,
      { consent: "yes", email: "member@example.com" },
      { "Sec-Fetch-Site": "cross-site" },
    );
    assert.equal(crossSite.status, 403);

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
    // Only the email field gets the address back.
    assert.match(body, /value="member@example\.com"/);
    assert.equal(storefrontCalls, 0);
    assert.equal(adminCalls, 0);
    assert.doesNotMatch(JSON.stringify(logs), /member@example\.com/);

    let htmlResponse = await app.fetch(
      documentRequest({ consent: "yes", email: "member@example.com" }),
    );
    let html = await htmlResponse.text();
    assert.equal(htmlResponse.status, 503);
    assert.match(htmlResponse.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(html, /<title>Subscribe/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Something went wrong/);
    assert.match(html, /value="member@example\.com"/);
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

  it(
    "cancels oversized localized uploads without waiting for the rest of the body",
    { timeout: 2_000 },
    async () => {
      let cancelled = false;
      let app = createTestApp(async () => {
        throw new Error("Invalid subscriptions must not query Shopify");
      });
      let init: RequestInit & { duplex: "half" } = {
        method: "POST",
        headers: {
          Origin: "https://example.com",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        duplex: "half",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`email=${"a".repeat(5000)}`),
            );
            // Leave the upload open: rejecting it must cancel the source stream.
          },
          cancel() {
            cancelled = true;
          },
        }),
      };

      let response = await app.fetch(
        new Request("https://example.com/en-ca/subscribe", init),
      );

      assert.equal(response.status, 400);
      assert.equal(cancelled, true);
      assert.match(await response.text(), /Invalid form submission/);
    },
  );

  it("renders validation errors as HTML without JavaScript", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: { rateLimiter: allowAll() },
    });
    let response = await app.fetch(
      documentRequest({ email: "member@example.com" }),
    );
    let html = await response.text();
    assert.equal(response.status, 400);
    assert.match(response.headers.get("Content-Type") ?? "", /text\/html/);
    assert.match(html, /<title>Subscribe/);
    assert.match(html, /role="alert"/);
    assert.match(html, /agree to receive emails/);
    // The page renders the form itself, restoring what was typed.
    assert.match(html, /name="email"[^>]* value="member@example\.com"/);
  });

  it("restores the email and shows field errors in the frame", async () => {
    let app = createTestApp(createStorefrontFetch({}), {
      subscribe: { rateLimiter: allowAll() },
    });

    let response = await post(app, { consent: "yes", email: "not-email" });
    let html = await response.text();

    assert.equal(response.status, 400);
    assert.doesNotMatch(html, /<html/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /value="not-email"/);
    assert.match(
      html,
      /role="alert"[^>]*>Please enter a valid email address\./,
    );
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
    let request = documentRequest({
      consent: "yes",
      email: "member@example.com",
    });
    request.headers.set("Referer", "https://example.com/subscribe");
    request.headers.delete("Origin");
    let response = await app.fetch(request);
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.match(html, /<title>Subscribe/);
    assert.match(html, /Thanks for subscribing/);
    assert.match(html, /value="member@example\.com"/);
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
          selectedOptions: [
            { name: "Color", value: "Blue" },
            { name: "Size", value: "Large" },
          ],
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

  it("returns a successful no-JavaScript back-in-stock signup to its variant", async () => {
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
          selectedOptions: [{ name: "Color", value: "Blue" }],
          title: "Blue",
        },
      }),
    });
    let app = createTestApp(storefrontFetch, {
      subscribe: { adminFetch: adminFetch([]), rateLimiter: allowAll() },
    });
    let response = await app.fetch(
      documentRequest({
        consent: "yes",
        email: "member@example.com",
        "product-handle": "test-product",
        "variant-id": "gid://shopify/ProductVariant/222",
      }),
    );
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/products/test-product?Color=Blue&subscribed=gid%3A%2F%2Fshopify%2FProductVariant%2F222",
    );
  });

  it("leaves Shopify's lone Default Title out of the product redirect", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        ...shellHandlers,
        RemixBackInStockSubscription: () => ({
          node: verifiedVariant({
            selectedOptions: [{ name: "Title", value: "Default Title" }],
          }),
        }),
      }),
      { subscribe: { adminFetch: adminFetch([]), rateLimiter: allowAll() } },
    );

    let response = await app.fetch(
      documentRequest({
        consent: "yes",
        email: "member@example.com",
        "product-handle": "test-product",
        "variant-id": "gid://shopify/ProductVariant/222",
      }),
    );

    assert.equal(
      response.headers.get("Location"),
      "/products/test-product?subscribed=gid%3A%2F%2Fshopify%2FProductVariant%2F222",
    );
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
              selectedOptions: [{ name: "Color", value: "Blue" }],
              title: "Blue",
            },
          };
        },
      }),
      {
        subscribe: { adminFetch: adminFetch([]), rateLimiter: allowAll() },
      },
    );
    let request = documentRequest({
      consent: "yes",
      email: "member@example.com",
      "product-handle": "test-product",
      "variant-id": "gid://shopify/ProductVariant/222",
    });
    request = new Request(
      request.url.replace("/subscribe", "/en-ca/subscribe"),
      request,
    );

    let response = await app.fetch(request);
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/en-ca/products/test-product?Color=Blue&subscribed=gid%3A%2F%2Fshopify%2FProductVariant%2F222",
    );
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
    // Admin's response never reaches the page; only the typed email returns.
    assert.doesNotMatch(body, /customer/);
    assert.match(body, /value="member@example\.com"/);
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
  selectedOptions: Array<{ name: string; value: string }>;
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
    selectedOptions: [{ name: "Color", value: "Blue" }],
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

/** A submission from the form's frame, as the enhanced form sends it. */
function formRequest(fields: Record<string, string>, headers?: HeadersInit) {
  return new Request("https://example.com/subscribe", {
    method: "POST",
    headers: {
      Origin: "https://example.com",
      "X-Remix-Frame": "true",
      "X-Remix-Target": "subscribe",
      ...headers,
    },
    body: new URLSearchParams(fields),
  });
}

/** A native submission of the whole page, without JavaScript. */
function documentRequest(fields: Record<string, string>) {
  return new Request("https://example.com/subscribe", {
    method: "POST",
    headers: { Origin: "https://example.com" },
    body: new URLSearchParams(fields),
  });
}

function frameRequest(url: string) {
  return new Request(url, {
    headers: { "X-Remix-Frame": "true", "X-Remix-Target": "subscribe" },
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
