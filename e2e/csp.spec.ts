import { expect, test } from "playwright/test";

test("hydrates, adds to cart, and navigates without CSP violations", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let violations: string[] = [];
    (window as { cspViolations?: string[] }).cspViolations = violations;
    document.addEventListener("securitypolicyviolation", (event) => {
      violations.push(`${event.effectiveDirective} ${event.blockedURI}`);
    });
  });

  let response = await page.goto("/products/test-product");
  expect(response?.headers()["content-security-policy"]).toMatch(
    /script-src 'nonce-[^']+' 'strict-dynamic'/,
  );
  await page.evaluate(async () => {
    let entry = document.querySelector<HTMLScriptElement>(
      'script[type="module"]',
    );
    if (!entry?.src) throw new Error("Browser entry module was not found");
    await import(entry.src);
    (window as { documentMarker?: boolean }).documentMarker = true;
  });

  // Only a hydrated island updates the cart button in place.
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(
    page.getByRole("button", { name: "1 Item in cart" }),
  ).toBeVisible();

  // Frame responses carry their own nonce, which the runtime must translate.
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Apparel" })
    .click();
  await expect(page).toHaveURL(/\/collections\/apparel$/);
  await expect(
    page
      .getByRole("region", { name: "Collection products" })
      .locator('a[href="/products/apparel-product"]'),
  ).toBeVisible();

  expect(
    await page.evaluate(() => ({
      documentMarker: (window as { documentMarker?: boolean }).documentMarker,
      violations: (window as { cspViolations?: string[] }).cspViolations,
    })),
  ).toEqual({ documentMarker: true, violations: [] });
});
