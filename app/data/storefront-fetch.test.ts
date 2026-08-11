import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { createRetryingStorefrontFetch } from "./storefront-fetch.ts";

const endpoint = "https://example.myshopify.com/api/graphql.json";

describe("Storefront API fetch", () => {
  it("retries a query once after a transport failure", async () => {
    let calls = 0;
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 0,
      fetch: async () => {
        calls++;
        if (calls === 1) throw new TypeError("connection lost");
        return new Response("{}");
      },
    });

    let response = await storefrontFetch(
      endpoint,
      graphqlRequest("query Test { shop { id } }"),
    );

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it("retries a query once after a transient response", async () => {
    let calls = 0;
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 0,
      fetch: async () => {
        calls++;
        return calls === 1
          ? new Response(null, { status: 503 })
          : new Response("{}");
      },
    });

    let response = await storefrontFetch(
      endpoint,
      graphqlRequest("query Test { shop { id } }"),
    );

    assert.equal(response.status, 200);
    assert.equal(calls, 2);
  });

  it("does not retry aborted queries", async () => {
    let calls = 0;
    let controller = new AbortController();
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 0,
      fetch: async () => {
        calls++;
        controller.abort(new DOMException("Aborted", "AbortError"));
        throw controller.signal.reason;
      },
    });

    await assert.rejects(
      storefrontFetch(endpoint, {
        ...graphqlRequest("query Test { shop { id } }"),
        signal: controller.signal,
      }),
    );
    assert.equal(calls, 1);
  });

  it("stops before retrying when aborted during the delay", async () => {
    let calls = 0;
    let controller = new AbortController();
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 10_000,
      fetch: async () => {
        calls++;
        return new Response(null, { status: 503 });
      },
    });
    let request = storefrontFetch(endpoint, {
      ...graphqlRequest("query Test { shop { id } }"),
      signal: controller.signal,
    });

    await Promise.resolve();
    let reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    await assert.rejects(request, (error: unknown) => error === reason);
    assert.equal(calls, 1);
  });

  it("does not retry mutations", async () => {
    let calls = 0;
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 0,
      fetch: async () => {
        calls++;
        throw new TypeError("connection lost");
      },
    });

    await assert.rejects(
      storefrontFetch(
        endpoint,
        graphqlRequest("mutation Test { cartCreate { cart { id } } }"),
      ),
    );
    assert.equal(calls, 1);
  });
});

function graphqlRequest(query: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  };
}
