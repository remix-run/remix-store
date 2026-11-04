import * as assert from "remix/assert";
import { ContentSecurityPolicy } from "remix/headers";
import { createRouter } from "remix/router";
import { describe, it } from "remix/test";

import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../testing/storefront.ts";
import { csp } from "./csp.ts";

function createShellApp() {
  return createTestApp(
    createStorefrontFetch({
      RemixAnalyticsShop: analyticsShopData,
      RemixNavigation: navigationData,
    }),
  );
}

function policyNonce(policy: ContentSecurityPolicy): string {
  let nonce = policy
    .get("script-src")
    ?.map((source) => /^'nonce-(.+)'$/.exec(source)?.[1])
    .find(Boolean);
  assert.ok(nonce, "script-src has a nonce");
  return nonce;
}

describe("content security policy", () => {
  it("authorizes every document script and preload with the response nonce", async () => {
    let response = await createShellApp().fetch(
      new Request("https://example.com/subscribe"),
    );
    let html = await response.text();
    let policy = new ContentSecurityPolicy(
      response.headers.get("Content-Security-Policy") ?? "",
    );
    let nonce = policyNonce(policy);

    assert.deepEqual(policy.get("script-src"), [
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
    ]);
    // A style nonce would disable 'unsafe-inline' for style attributes and
    // the unnonced style elements Shopify's scripts inject.
    assert.ok(policy.get("style-src")?.includes("'unsafe-inline'"));
    assert.ok(!policy.get("style-src")?.some((s) => s.startsWith("'nonce-")));
    assert.deepEqual(policy.get("object-src"), ["'none'"]);
    assert.deepEqual(policy.get("frame-ancestors"), ["'none'"]);
    assert.ok(!policy.get("connect-src")?.some((s) => s.includes("localhost")));

    let executable = [...html.matchAll(/<script\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => !tag.includes('type="application/json"'));
    let preloads = html.match(/<link\b[^>]*rel="modulepreload"[^>]*>/g) ?? [];
    for (let id of [
      "shopify-global-bootstrap",
      "shopify-analytics-bus",
      "shopify-standard-actions",
    ]) {
      assert.ok(
        executable.some((tag) => tag.includes(`id="${id}"`)),
        id,
      );
    }
    assert.ok(executable.some((tag) => tag.includes('type="importmap"')));
    assert.ok(preloads.length > 0);
    for (let tag of [...executable, ...preloads]) {
      assert.ok(tag.includes(`nonce="${nonce}"`), tag);
    }
  });

  it("uses a fresh nonce for each response, including frame navigations", async () => {
    let app = createShellApp();
    let document = await app.fetch(
      new Request("https://example.com/subscribe"),
    );
    let frame = await app.fetch(
      new Request("https://example.com/subscribe", {
        headers: { "X-Remix-Frame": "true" },
      }),
    );
    let documentNonce = policyNonce(
      new ContentSecurityPolicy(
        document.headers.get("Content-Security-Policy") ?? "",
      ),
    );
    let frameNonce = policyNonce(
      new ContentSecurityPolicy(
        frame.headers.get("Content-Security-Policy") ?? "",
      ),
    );

    assert.notEqual(frameNonce, documentNonce);
    // The browser runtime rewrites the frame's nonce to the document's.
    assert.match(await frame.text(), new RegExp(`nonce="${frameNonce}"`));
  });

  it("allows local HMR connections only in development", async () => {
    let router = createRouter({
      middleware: [csp({ development: true })],
    });
    router.get(
      "/",
      () =>
        new Response("<!doctype html>", {
          headers: { "Content-Type": "text/html" },
        }),
    );

    let response = await router.fetch("https://example.com/");
    let connectSrc = new ContentSecurityPolicy(
      response.headers.get("Content-Security-Policy") ?? "",
    ).get("connect-src");

    assert.ok(connectSrc?.includes("http://127.0.0.1:*"));
    assert.ok(connectSrc?.includes("ws://localhost:*"));
  });
});
