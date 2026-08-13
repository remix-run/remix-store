import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  CA_MARKET,
  resolveMarketPath,
  US_MARKET,
} from "../lib/public/market.ts";
import { createTestApp } from "../testing/storefront.ts";

describe("market routing", () => {
  it("resolves unprefixed US and prefix-stripped Canadian paths", () => {
    assert.deepEqual(resolveMarketPath("/products/shirt"), {
      kind: "market",
      market: US_MARKET,
      pathname: "/products/shirt",
    });
    assert.deepEqual(resolveMarketPath("/en-ca/products/shirt"), {
      kind: "market",
      market: CA_MARKET,
      pathname: "/products/shirt",
    });
  });

  it("canonicalizes supported market aliases", () => {
    assert.deepEqual(resolveMarketPath("/en-us/products/shirt"), {
      kind: "redirect",
      pathname: "/products/shirt",
    });
    assert.deepEqual(resolveMarketPath("/fr-ca/products/shirt"), {
      kind: "redirect",
      pathname: "/en-ca/products/shirt",
    });
  });

  it("rejects common unsupported BCP47-like language, script, and region prefixes", () => {
    for (let prefix of [
      "fr",
      "fra",
      "de-DE",
      "zh-Hant",
      "zh-Hant-TW",
      "es-419",
    ]) {
      assert.deepEqual(resolveMarketPath(`/${prefix}/products/shirt`), {
        kind: "unsupported",
      });
    }
  });

  it("does not misclassify known app and Shopify compatibility paths", () => {
    for (let prefix of [
      "api",
      "apps",
      "cart",
      "admin",
      "checkout",
      "products",
      "collections",
      "policies",
      "discount",
      "search",
    ]) {
      let pathname = `/${prefix}/example`;
      assert.deepEqual(resolveMarketPath(pathname), {
        kind: "market",
        market: US_MARKET,
        pathname,
      });
    }
  });

  it("redirects aliases permanently with suffixes and queries intact", async () => {
    let app = createTestApp(async () => {
      throw new Error("Alias redirects must not query Shopify");
    });

    let us = await app.fetch(
      new Request("https://example.com/en-us/products/shirt?Color=Blue"),
    );
    assert.equal(us.status, 308);
    assert.equal(us.headers.get("Location"), "/products/shirt?Color=Blue");

    let ca = await app.fetch(
      new Request("https://example.com/fr-ca/products/shirt?Color=Blue"),
    );
    assert.equal(ca.status, 308);
    assert.equal(
      ca.headers.get("Location"),
      "/en-ca/products/shirt?Color=Blue",
    );
  });

  it("returns a real 404 for unsupported locale-like prefixes before Shopify", async () => {
    let app = createTestApp(async () => {
      throw new Error("Unsupported locales must not query Shopify");
    });
    for (let prefix of ["de-de", "zh-Hant", "es-419"]) {
      let response = await app.fetch(
        new Request(`https://example.com/${prefix}/products/shirt`),
      );

      assert.equal(response.status, 404);
      assert.match(await response.text(), /Page not found/);
    }
  });
});
