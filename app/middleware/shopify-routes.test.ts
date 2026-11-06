import { createShopifyRequestContext } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { applyResponseHeaders } from "./shopify-routes.ts";

function requestContext() {
  return createShopifyRequestContext({
    request: new Request("https://storefront.example/"),
    i18n: { country: "US", language: "EN" },
    buyerIp: "203.0.113.7",
  });
}

describe("applyResponseHeaders", () => {
  it("adds Shopify's headers to responses with immutable headers", () => {
    let context = requestContext();
    let expected = new Headers();
    context.applyResponseHeaders(expected);
    assert.ok([...expected].length > 0, "Shopify adds response headers");

    // Response.redirect() returns immutable headers, as fetch() responses do.
    let immutable = Response.redirect("https://storefront.example/cart", 303);
    assert.throws(() => immutable.headers.set("x-probe", "1"), TypeError);

    let response = applyResponseHeaders(context, immutable);

    assert.equal(response.status, 303);
    assert.equal(
      response.headers.get("Location"),
      "https://storefront.example/cart",
    );
    for (let [name, value] of expected) {
      assert.equal(response.headers.get(name), value, name);
    }
  });

  it("updates mutable responses in place", () => {
    let original = new Response("ok");

    let response = applyResponseHeaders(requestContext(), original);

    assert.equal(response, original);
  });
});
