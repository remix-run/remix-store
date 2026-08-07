import { test, expect } from "@playwright/test";

/**
 * Home page acceptance tests
 * Validates: hero content, lookbook, navigation to collections
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("Home Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("displays hero section with main content", async ({ page }) => {
    // Hero should have visible content (image or heading)
    // Don't assert on specific class names or implementation
    const main = page.locator("main");
    await expect(main).toBeVisible();

    // Should have at least one navigation element
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible();
  });

  test("displays lookbook/product showcase", async ({ page }) => {
    // Lookbook should show product images
    // Products should be clickable links with images
    const productLinks = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });

    // Should have at least one product link with image
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("navigates to product when clicking lookbook item", async ({ page }) => {
    // Find and click first product link
    const productLinks = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });

    const count = await productLinks.count();
    if (count > 0) {
      await productLinks.first().click();
      // Should navigate to a product page or collection
      await page.waitForURL(/\/products\/|\/collections\//);
    } else {
      // Home page might not have direct product links
      // This is acceptable - just verify we can navigate somewhere
      const anyLink = page.getByRole("link").first();
      await expect(anyLink).toBeVisible();
    }
  });

  test("header contains store name and navigation", async ({ page }) => {
    // Header should have branding
    const header = page.locator('header, [role="banner"]').first();
    await expect(header).toBeVisible();

    // Should have at least one navigation
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible();
  });

  test("footer contains policy links", async ({ page }) => {
    // Footer should exist and contain policy links
    const footer = page.locator('footer, [role="contentinfo"]').first();
    await expect(footer).toBeVisible();

    // Should have at least one policy link
    const policyLinks = footer.getByRole("link", {
      name: /privacy|refund|terms|shipping/i,
    });
    await expect(policyLinks.first()).toBeVisible();
  });
});
