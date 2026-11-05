import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../testing/storefront.ts";
import type { CspOptions } from "./csp.ts";

async function fetchPage(csp?: CspOptions) {
  let app = createTestApp(
    createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixNavigation: navigationData,
    }),
    { csp },
  );
  let response = await app.fetch(
    new Request("https://example.com/missing-page"),
  );
  let policy = response.headers.get("Content-Security-Policy") ?? "";
  let directives = new Map(
    policy.split(";").map((directive) => {
      let [name = "", ...sources] = directive.trim().split(/\s+/);
      return [name, sources];
    }),
  );
  return { directives, html: await response.text() };
}

describe("content security policy", () => {
  it("allows only the page's nonced scripts and forbids framing", async () => {
    let { directives, html } = await fetchPage();

    let nonce = directives
      .get("script-src")
      ?.find((source) => source.startsWith("'nonce-"))
      ?.slice("'nonce-".length, -1);
    assert.ok(nonce, "script-src carries a nonce");
    let scriptNonces = [...html.matchAll(/<script\b[^>]*\snonce="([^"]+)"/g)];
    assert.ok(scriptNonces.length > 0, "the page renders nonced scripts");
    for (let [, scriptNonce] of scriptNonces) assert.equal(scriptNonce, nonce);
    // JSON data blocks never execute, so CSP does not govern them.
    let unnoncedScripts = [...html.matchAll(/<script\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => !/\snonce=/.test(tag))
      .filter((tag) => !/\stype="application\/json"/.test(tag));
    assert.deepEqual(unnoncedScripts, []);

    assert.deepEqual(directives.get("frame-ancestors"), ["'none'"]);
    assert.deepEqual(directives.get("object-src"), ["'none'"]);
    assert.deepEqual(directives.get("base-uri"), ["'none'"]);
  });

  it("uses a fresh nonce for every response", async () => {
    let first = await fetchPage();
    let second = await fetchPage();

    assert.notDeepEqual(
      first.directives.get("script-src"),
      second.directives.get("script-src"),
    );
  });

  it("opens local HMR connections only in development", async () => {
    let production = await fetchPage();
    let development = await fetchPage({ development: true });

    assert.doesNotMatch(
      production.directives.get("connect-src")?.join(" ") ?? "",
      /localhost|127\.0\.0\.1/,
    );
    let connectSrc = development.directives.get("connect-src") ?? [];
    assert.ok(connectSrc.includes("ws://localhost:*"));
    assert.ok(connectSrc.includes("http://127.0.0.1:*"));
  });
});
