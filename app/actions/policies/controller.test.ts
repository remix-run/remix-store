import * as assert from "remix/assert";
import { describe, it } from "remix/test";

import { routes } from "../../routes.ts";
import {
  analyticsShopData,
  createStorefrontFetch,
  createTestApp,
  navigationData,
} from "../../testing/storefront.ts";

describe("policy routes", () => {
  it("renders sanitized Shopify policy content in the branded document", async () => {
    let variables: Record<string, unknown> | undefined;
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
    assert.match(html, /<title>Privacy policy<\/title>/);
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

  it("maps contact information to Shopify's contact page", async () => {
    let variables: Record<string, unknown> | undefined;
    let app = createTestApp(
      createStorefrontFetch({
        RemixAnalyticsShop: analyticsShopData,
        RemixContact(body) {
          variables = body.variables;
          return {
            page: {
              body: "<p>Email support@example.com</p>",
              id: "gid://shopify/Page/contact",
              title: "Contact us",
            },
          };
        },
        RemixNavigation: navigationData,
      }),
    );

    let response = await app.fetch(
      new Request(
        `https://example.com${routes.policies.show.href({ handle: "contact-information" })}`,
      ),
    );
    let html = await response.text();

    assert.equal(response.status, 200);
    assert.equal(variables?.handle, "contact");
    assert.match(html, /Contact us/);
    assert.match(html, /Email support@example\.com/);
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
