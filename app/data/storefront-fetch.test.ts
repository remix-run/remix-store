import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { createRetryingStorefrontFetch } from "./storefront-fetch.ts";

const endpoint = "https://example.myshopify.com/api/graphql.json";

describe("Storefront API fetch", () => {
  it("retries a query once after a transport failure", async (t) => {
    let fetch = t.mock.fn(async () => new Response("{}"));
    fetch.mock.mockImplementationOnce(async () => {
      throw new TypeError("connection lost");
    });
    let storefrontFetch = createRetryingStorefrontFetch({ delayMs: 0, fetch });

    let response = await storefrontFetch(
      endpoint,
      graphqlRequest("query Test { shop { id } }"),
    );

    assert.equal(response.status, 200);
    assert.equal(fetch.mock.callCount(), 2);
  });

  it("retries a query once after a transient response", async (t) => {
    let fetch = t.mock.fn(async () => new Response("{}"));
    fetch.mock.mockImplementationOnce(
      async () => new Response(null, { status: 503 }),
    );
    let storefrontFetch = createRetryingStorefrontFetch({ delayMs: 0, fetch });

    let response = await storefrontFetch(
      endpoint,
      graphqlRequest("query Test { shop { id } }"),
    );

    assert.equal(response.status, 200);
    assert.equal(fetch.mock.callCount(), 2);
  });

  it("does not retry aborted queries", async (t) => {
    let controller = new AbortController();
    let fetch = t.mock.fn(async (): Promise<Response> => {
      controller.abort(new DOMException("Aborted", "AbortError"));
      throw controller.signal.reason;
    });
    let storefrontFetch = createRetryingStorefrontFetch({ delayMs: 0, fetch });

    await assert.rejects(
      storefrontFetch(endpoint, {
        ...graphqlRequest("query Test { shop { id } }"),
        signal: controller.signal,
      }),
    );
    assert.equal(fetch.mock.callCount(), 1);
  });

  it("stops before retrying when aborted during the delay", async (t) => {
    let controller = new AbortController();
    let fetch = t.mock.fn(async () => new Response(null, { status: 503 }));
    let storefrontFetch = createRetryingStorefrontFetch({
      delayMs: 10_000,
      fetch,
    });
    let request = storefrontFetch(endpoint, {
      ...graphqlRequest("query Test { shop { id } }"),
      signal: controller.signal,
    });

    await Promise.resolve();
    let reason = new DOMException("Aborted", "AbortError");
    controller.abort(reason);

    assert.equal(await rejectedError(request), reason);
    assert.equal(fetch.mock.callCount(), 1);
  });

  it("does not retry mutations", async (t) => {
    let fetch = t.mock.fn(async (): Promise<Response> => {
      throw new TypeError("connection lost");
    });
    let storefrontFetch = createRetryingStorefrontFetch({ delayMs: 0, fetch });

    await assert.rejects(
      storefrontFetch(
        endpoint,
        graphqlRequest("mutation Test { cartCreate { cart { id } } }"),
      ),
    );
    assert.equal(fetch.mock.callCount(), 1);
  });
});

async function rejectedError(request: Promise<Response>): Promise<Error> {
  try {
    await request;
  } catch (error) {
    assert.ok(
      error instanceof Error,
      "Expected the request to reject with Error",
    );
    return error;
  }
  return assert.fail("Expected the request to reject");
}

function graphqlRequest(query: string): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  };
}
