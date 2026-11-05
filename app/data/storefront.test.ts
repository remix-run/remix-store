import { StorefrontApiError, StorefrontTimeoutError } from "@shopify/hydrogen";
import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  isStorefrontFailure,
  requireStorefrontData,
  StorefrontQueryError,
} from "./storefront.ts";

describe("requireStorefrontData", () => {
  it("returns data from a successful response", () => {
    assert.deepEqual(requireStorefrontData({ data: { shop: 1 } }, "missing"), {
      shop: 1,
    });
  });

  it("throws GraphQL errors and empty responses with the errors as cause", () => {
    let errors = [{ message: "Upstream failure" }];

    assert.throws(
      () => requireStorefrontData({ data: { shop: 1 }, errors }, "no shop"),
      (error: unknown) =>
        error instanceof StorefrontQueryError &&
        error.message === "no shop" &&
        error.cause === errors,
    );
    assert.throws(
      () => requireStorefrontData({ data: null }, "no shop"),
      StorefrontQueryError,
    );
  });
});

describe("isStorefrontFailure", () => {
  it("accepts Storefront failures and rejects aborts and bugs", () => {
    assert.ok(isStorefrontFailure(new StorefrontApiError("down")));
    assert.ok(isStorefrontFailure(new StorefrontTimeoutError(1)));
    assert.ok(isStorefrontFailure(new StorefrontQueryError("no data")));

    assert.ok(!isStorefrontFailure(new DOMException("aborted", "AbortError")));
    assert.ok(!isStorefrontFailure(new TypeError("bug")));
  });
});
