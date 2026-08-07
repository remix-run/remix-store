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
    const hero = page.locator("main").first();
    await expect(hero).toBeVisible();

    // Should have navigation to shop
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  test("displays lookbook/product showcase", async ({ page }) => {
    // Lookbook should show product images
    // Products should be clickable links
    const productLinks = page.getByRole("link").filter({
      has: page.locator(
        'img[alt*="product" i], img[alt*="shirt" i], img[alt*="sticker" i], img[alt*="hat" i]',
      ),
    });

    await expect(productLinks.first()).toBeVisible();
  });

  test("navigates to product when clicking lookbook item", async ({ page }) => {
    // Find and click first product link
    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await firstProduct.click();

    // Should navigate to a product page
    await expect(page).toHaveURL(/\/products\//);
  });

  test("header contains store name and navigation", async ({ page }) => {
    // Header should have branding
    const header = page.locator('header, [role="banner"]').first();
    await expect(header).toBeVisible();

    // Should have main navigation
    const nav = page.getByRole("navigation");
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
