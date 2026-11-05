import { createCartCookie } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { CART_ID, createCart } from "../testing/cart-fixtures.ts";
import {
  createTestStorefrontClient,
  graphqlResponse,
} from "../testing/storefront-client.ts";
import { loadCartDataOrEmpty } from "./cart-handlers.ts";

describe("loadCartDataOrEmpty", () => {
  it("skips the query without a cart cookie", async () => {
    let queries = 0;
    let client = createTestStorefrontClient(async () => {
      queries += 1;
      return graphqlResponse({ cart: createCart() });
    });

    assert.deepEqual(
      await loadCartDataOrEmpty(client, new Request("https://example.com/")),
      { cart: null },
    );
    assert.equal(queries, 0);
  });

  it("loads the cart named by the cookie", async () => {
    let client = createTestStorefrontClient(async () =>
      graphqlResponse({ cart: createCart(2) }),
    );

    let data = await loadCartDataOrEmpty(client, cartRequest());
    assert.equal(data.cart?.id, CART_ID);
    assert.equal(data.cart?.totalQuantity, 2);
  });

  it("renders an empty cart during a Storefront outage", async (t) => {
    let logs: unknown[][] = [];
    t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
    let client = createTestStorefrontClient(async () => {
      throw new TypeError("connection lost");
    });

    assert.deepEqual(await loadCartDataOrEmpty(client, cartRequest()), {
      cart: null,
    });
    assert.match(String(logs[0]?.[0]), /Cart query failed/);
  });

  it("propagates request aborts", async () => {
    let controller = new AbortController();
    let abort = new DOMException("The request was aborted", "AbortError");
    let client = createTestStorefrontClient(async () => {
      controller.abort(abort);
      throw abort;
    });

    await assert.rejects(
      loadCartDataOrEmpty(client, cartRequest(controller.signal)),
      (error: unknown) => error === abort,
    );
  });
});

function cartRequest(signal?: AbortSignal): Request {
  let cookie = createCartCookie(CART_ID).split(";", 1)[0];
  return new Request("https://example.com/", {
    headers: { Cookie: cookie ?? "" },
    signal,
  });
}
