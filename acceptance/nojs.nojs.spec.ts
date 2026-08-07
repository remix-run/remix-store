import { test, expect } from "@playwright/test";

/**
 * No-JS acceptance tests
 * Validates: core functionality works without JavaScript
 * Tests run with javaScriptEnabled: false
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("No-JS Functionality", () => {
  test("home page loads without JavaScript", async ({ page }) => {
    await page.goto("/");

    // Should show content
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Should have at least one navigation element
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible();
  });

  test("can navigate to collections without JavaScript", async ({ page }) => {
    await page.goto("/");

    // Find navigation link to collections/shop
    const collectionsLink = page
      .getByRole("link", { name: /shop|collections|products/i })
      .first();

    if (await collectionsLink.isVisible()) {
      await collectionsLink.click();

      // Should navigate to collections
      await expect(page).toHaveURL(/\/collections|\/shop|\/products/);
    }
  });

  test("collection page loads without JavaScript", async ({ page }) => {
    await page.goto("/collections/all");

    // Should show products
    const products = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });

    await expect(products.first()).toBeVisible();
  });

  test("can navigate to product from collection without JavaScript", async ({
    page,
  }) => {
    await page.goto("/collections/all");

    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await firstProduct.click();

    // Should navigate to product page
    await expect(page).toHaveURL(/\/products\//);
  });

  test("product page loads without JavaScript", async ({ page }) => {
    await page.goto("/collections/all");

    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await firstProduct.click();
    await page.waitForURL(/\/products\//);

    // Should show product details
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Should have image
    await expect(page.locator("img[alt]").first()).toBeVisible();

    // Should have price
    await expect(page.getByText(/\$\d+/).first()).toBeVisible();
  });

  test("add to cart form is functional without JavaScript", async ({
    page,
  }) => {
    await page.goto("/collections/all");

    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await firstProduct.click();
    await page.waitForURL(/\/products\//);

    // Should have add to cart button within a form
    const addToCartButton = page.getByRole("button", {
      name: /add to cart|add to bag/i,
    });
    await expect(addToCartButton).toBeVisible();

    // Verify the button is inside a form with proper action
    // This ensures no-JS add-to-cart would work via form submission
    const form = page.locator("form").filter({
      has: addToCartButton,
    });

    await expect(form).toBeVisible();

    // Form should have an action attribute (required for no-JS submission)
    const formAction = await form.getAttribute("action");
    expect(formAction).toBeTruthy();
    expect(formAction).toMatch(/\/cart/);
  });

  test("policy pages load without JavaScript", async ({ page }) => {
    const response = await page.goto("/policies/privacy-policy");

    expect(response?.status()).toBe(200);

    // Should have heading
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Should have content
    const content = await page
      .locator('main, [role="main"]')
      .first()
      .textContent();
    expect(content!.length).toBeGreaterThan(100);
  });

  test("footer links work without JavaScript", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator('footer, [role="contentinfo"]');
    const policyLink = footer.getByRole("link", { name: /privacy/i }).first();

    if (await policyLink.isVisible()) {
      await policyLink.click();

      // Should navigate
      await expect(page).toHaveURL(/\/policies\//);
    }
  });

  test("robots.txt accessible without JavaScript", async ({ page }) => {
    const response = await page.goto("/robots.txt");

    expect(response?.status()).toBe(200);

    const content = await page.textContent("body");
    expect(content).toMatch(/User-agent:/i);
  });

  test("sitemap.xml accessible without JavaScript", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");

    expect(response?.status()).toBe(200);

    const content = await page.textContent("body");
    expect(content).toMatch(/<urlset/);
  });
});
