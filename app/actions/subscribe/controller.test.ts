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
    assert.match(html, /Enter your email below to subscribe\./);
    assert.match(html, /action="\/subscribe" method="post"/);

    // What a signup without scripts left behind shows in the same frame.
    let thanks = await app.fetch(
      new Request("https://example.com/subscribe?subscription=success"),
    );
    assert.match(await thanks.text(), /Thanks for subscribing/);
    let limited = await app.fetch(
      new Request("https://example.com/subscribe?subscription=limited"),
    );
    assert.match(await limited.text(), /Too many attempts/);

    // The signup frame gets the form alone.
    let fragment = await app.fetch(
      new Request("https://example.com/subscribe", { headers: FRAME_HEADERS }),
    );
    let form = await fragment.text();
    assert.equal(fragment.status, 200);
    assert.equal(fragment.headers.get("X-Robots-Tag"), "noindex");
    assert.doesNotMatch(form, /<html|<title>/);
    assert.match(form, /action="\/subscribe" method="post"/);
    assert.match(form, /type="email"/);
    assert.match(form, /name="email"/);
    assert.match(form, /type="hidden"/);
    assert.match(form, /name="consent"/);
    assert.match(form, /value="yes"/);
    assert.doesNotMatch(form, /type="checkbox"/);
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
          ...FRAME_HEADERS,
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
    "rejects oversized localized uploads without waiting for the rest of the body",
    { timeout: 2_000 },
    async () => {
      // Only the page shell may query Shopify.
      let app = createTestApp(createStorefrontFetch(shellHandlers));
      let init: RequestInit & { duplex: "half" } = {
        method: "POST",
        headers: {
          ...FRAME_HEADERS,
          Origin: "https://example.com",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        duplex: "half",
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode(`email=${"a".repeat(5000)}`),
            );
            // Leave the upload open: rejecting must not wait for the rest.
          },
        }),
      };

      let response = await app.fetch(
        new Request("https://example.com/en-ca/subscribe", init),
      );

      assert.equal(response.status, 400);
      assert.match(await response.text(), /Invalid form submission/);
    },
  );

  it("sends a failed post without JavaScript back to the page with the outcome", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: { rateLimiter: allowAll() },
    });
    let response = await app.fetch(
      formRequest({ email: "member@example.com" }),
    );
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/subscribe?subscription=invalid",
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");

    // The page's signup frame reads the outcome from its URL, not the email.
    let page = await app.fetch(
      new Request("https://example.com/subscribe?subscription=invalid"),
    );
    let html = await page.text();
    assert.match(html, /<title>Subscribe \| The Remix Store<\/title>/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Please check your details/);
    assert.doesNotMatch(html, /member@example\.com/);
  });

  it("restores the submitted email after a validation error in the frame", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: { rateLimiter: allowAll() },
    });
    let fragment = await post(app, { email: 'Member+"test"@example.com' });
    let form = await fragment.text();
    assert.equal(fragment.status, 400);
    assert.match(form, /value="Member\+&quot;test&quot;@example\.com"/);
    assert.match(form, /agree to receive emails/);
  });

  it("does not echo a submitted value when the form itself is invalid", async () => {
    let app = createTestApp(createStorefrontFetch(shellHandlers), {
      subscribe: { rateLimiter: allowAll() },
    });
    let response = await post(app, {
      consent: "yes",
      email: "member@example.com",
      unexpected: "field",
    });
    let html = await response.text();
    assert.equal(response.status, 400);
    assert.match(html, /The form submission is invalid\./);
    assert.doesNotMatch(html, /member@example\.com/);
  });

  it("subscribes a newsletter customer and redirects to the confirmation without JavaScript", async () => {
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
    request.headers.set("Referer", "https://example.com/subscribe");
    request.headers.delete("Origin");
    let response = await app.fetch(request);

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "/subscribe?subscription=success",
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
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

  it("returns a successful no-JavaScript back-in-stock submission to its form", async () => {
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
    let request = formRequest(
      {
        consent: "yes",
        email: "member@example.com",
        "product-handle": "test-product",
        "variant-id": "gid://shopify/ProductVariant/222",
      },
      {},
      `?${BACK_IN_STOCK.replace("&subscription=success", "")}`,
    );
    let response = await app.fetch(request);
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      `/subscribe?${BACK_IN_STOCK}`,
    );
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  });

  it("keeps localized no-JavaScript back-in-stock outcomes in Canada", async () => {
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
    let request = formRequest(
      {
        consent: "yes",
        email: "member@example.com",
        "product-handle": "test-product",
        "variant-id": "gid://shopify/ProductVariant/222",
      },
      {},
      `?${BACK_IN_STOCK.replace("&subscription=success", "")}`,
    );
    request = new Request(
      request.url.replace("/subscribe", "/en-ca/subscribe"),
      request,
    );

    let response = await app.fetch(request);
    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      `/en-ca/subscribe?${BACK_IN_STOCK}`,
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
    assert.doesNotMatch(body, /customer/);
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

const BACK_IN_STOCK =
  "product-handle=test-product&variant-id=gid%3A%2F%2Fshopify%2FProductVariant%2F222&subscription=success";

const FRAME_HEADERS = {
  "X-Remix-Frame": "true",
  "X-Remix-Target": "subscribe",
};

/** Posts from the signup form's frame, which answers with a fragment. */
function post(
  app: ReturnType<typeof createTestApp>,
  fields: Record<string, string>,
  headers?: HeadersInit,
) {
  return app.fetch(formRequest(fields, { ...FRAME_HEADERS, ...headers }));
}

/** A native form post, which answers with a whole page. */
function formRequest(
  fields: Record<string, string>,
  headers?: HeadersInit,
  query = "",
) {
  return new Request(`https://example.com/subscribe${query}`, {
    method: "POST",
    headers: { Origin: "https://example.com", ...headers },
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
