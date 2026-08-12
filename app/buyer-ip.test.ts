import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { resolveNodeBuyerIp, resolveOxygenBuyerIp } from "./buyer-ip.ts";

describe("trusted buyer IP adapters", () => {
  it("reads only Oxygen's platform header in the Oxygen adapter", () => {
    let request = new Request("https://storefront.example", {
      headers: {
        "fly-client-ip": "198.51.100.1",
        "oxygen-buyer-ip": "203.0.113.1",
      },
    });

    assert.equal(resolveOxygenBuyerIp(request), "203.0.113.1");
    assert.equal(
      resolveOxygenBuyerIp(new Request("https://storefront.example")),
      undefined,
    );
  });

  it("reads only Fly's platform header when the Node process is on Fly", () => {
    let request = new Request("https://storefront.example", {
      headers: {
        "fly-client-ip": "198.51.100.1",
        "oxygen-buyer-ip": "203.0.113.1",
      },
    });

    assert.equal(
      resolveNodeBuyerIp(request, { FLY_APP_NAME: "remix-store" }),
      "198.51.100.1",
    );
    assert.equal(
      resolveNodeBuyerIp(new Request("https://storefront.example"), {
        FLY_APP_NAME: "remix-store",
      }),
      undefined,
    );
  });

  it("uses the Node HTTP adapter's client address outside Fly", () => {
    let request = new Request("https://storefront.example", {
      headers: {
        "fly-client-ip": "198.51.100.1",
        "oxygen-buyer-ip": "203.0.113.1",
      },
    });

    assert.equal(
      resolveNodeBuyerIp(request, { NODE_ENV: "production" }, "192.0.2.1"),
      "192.0.2.1",
    );
    assert.equal(
      resolveNodeBuyerIp(request, { NODE_ENV: "development" }, "127.0.0.1"),
      "127.0.0.1",
    );
    assert.equal(
      resolveNodeBuyerIp(request, { NODE_ENV: "production" }),
      undefined,
    );
  });
});
