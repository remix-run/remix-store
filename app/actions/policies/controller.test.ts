import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
  type StorefrontRequestBody,
} from "../../testing/storefront.ts";

describe("policy routes", () => {
  it("renders sanitized Shopify policy content in the branded document", async () => {
    let variables: StorefrontRequestBody["variables"] | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        RemixPolicy(body) {
          variables = body.variables;
          return {
            shop: {
              privacyPolicy: {
                body: `
                  <h2>Information we collect</h2>
                  <div style="position: fixed"><span>Policy copy</span></div>
                  <a href="/collections/all">Catalog</a>
                  <a href="https://example.org" target="_blank">Learn more</a>
                  <a href="javascript:alert('nope')">Unsafe</a>
                  <img src=x onerror="alert('nope')">
                  <script>alert('nope')</script>
                `,
                handle: "privacy-policy",
                id: "gid://shopify/ShopPolicy/privacy",
                title: "Privacy policy",
              },
            },
          };
        },
      }),
    );

    let response = await app.fetch(
      new Request(
        `https://example.com${routes.policies.show.href({ handle: "privacy-policy" })}`,
      ),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(variables?.privacyPolicy, true);
    assert.equal(variables?.refundPolicy, false);
    assert.match(html, /<title>Privacy policy \| The Remix Store<\/title>/);
    assert.match(html, /<h1[^>]*>Privacy policy<\/h1>/);
    assert.match(html, /<h2>Information we collect<\/h2>/);
    assert.match(html, /<div><span>Policy copy<\/span><\/div>/);
    assert.match(html, /rel="noopener noreferrer"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/example\.com\/policies\/privacy-policy"/,
    );
    assert.doesNotMatch(html, /javascript:/);
    assert.doesNotMatch(html, /onerror/);
    assert.doesNotMatch(html, /alert\('nope'\)/);
  });

  it("localizes Canadian policy canonicals and internal body links", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        RemixPolicy: () => ({
          shop: {
            privacyPolicy: {
              body: '<p><a href="/collections/all">Catalog</a></p>',
              handle: "privacy-policy",
              id: "privacy",
              title: "Privacy policy",
            },
          },
        }),
      }),
    );

    let response = await app.fetch(
      new Request("https://example.com/en-ca/policies/privacy-policy"),
    );
    let html = await response.text();
    assert.equal(response.status, 200);
    assert.match(html, /href="\/en-ca\/collections\/all"/);
    assert.match(
      html,
      /rel="canonical" href="https:\/\/example\.com\/en-ca\/policies\/privacy-policy"/,
    );
  });

  it("maps contact information to Shopify's contact page with market-separated context and cache entries", async () => {
    let variables: StorefrontRequestBody["variables"][] = [];
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixContact(body) {
          variables.push(body.variables);
          let country = String(body.variables.country);
          return {
            page: {
              body: `<p>Email ${country.toLowerCase()}@example.com</p>`,
              id: `gid://shopify/Page/contact-${country}`,
              title: `Contact ${country}`,
            },
          };
        },
        RemixNavigation: navigationData,
      }),
    );
    let pathname = routes.policies.show.href({
      handle: "contact-information",
    });

    let usResponse = await app.fetch(
      new Request(`https://example.com${pathname}`),
    );
    let caResponse = await app.fetch(
      new Request(`https://example.com/en-ca${pathname}`),
    );
    let usCachedResponse = await app.fetch(
      new Request(`https://example.com${pathname}`),
    );
    let [usHtml, caHtml, usCachedHtml] = await Promise.all([
      usResponse.text(),
      caResponse.text(),
      usCachedResponse.text(),
    ]);

    assert.equal(usResponse.status, 200);
    assert.equal(caResponse.status, 200);
    assert.deepEqual(variables, [
      { country: "US", handle: "contact", language: "EN" },
      { country: "CA", handle: "contact", language: "EN" },
    ]);
    assert.match(usHtml, /Contact US/);
    assert.match(usHtml, /Email us@example\.com/);
    assert.match(caHtml, /Contact CA/);
    assert.match(caHtml, /Email ca@example\.com/);
    assert.match(usCachedHtml, /Contact US/);
  });

  it("returns branded 404 pages for unsupported or missing content", async () => {
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixNavigation: navigationData,
        RemixPolicy: () => ({ shop: { refundPolicy: null } }),
      }),
    );

    let unsupported = await app.fetch(
      new Request("https://example.com/policies/not-a-policy"),
    );
    let inheritedKey = await app.fetch(
      new Request("https://example.com/policies/toString"),
    );
    let missing = await app.fetch(
      new Request("https://example.com/policies/refund-policy"),
    );

    assert.equal(unsupported.status, 404);
    assert.match(await unsupported.text(), /Page not found/);
    assert.equal(inheritedKey.status, 404);
    assert.match(await inheritedKey.text(), /Page not found/);
    assert.equal(missing.status, 404);
    assert.match(await missing.text(), /Page not found/);
  });
});
