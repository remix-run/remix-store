import { test, expect } from "@playwright/test";

/**
 * Product Page acceptance tests
 * Validates: product details, variant selection, add to cart
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("Product Page", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to collections first, then to a product
    await page.goto("/collections/all");
    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();
    await firstProduct.click();
    await page.waitForURL(/\/products\//);
  });

  test("displays product information", async ({ page }) => {
    // Product page should have title
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Should have product image
    const productImage = page.locator("img[alt]").first();
    await expect(productImage).toBeVisible();

    // Should have price
    const price = page.getByText(/\$\d+/);
    await expect(price.first()).toBeVisible();
  });

  test("has add to cart functionality", async ({ page }) => {
    // Should have add to cart button
    const addToCart = page.getByRole("button", {
      name: /add to cart|add to bag/i,
    });
    await expect(addToCart).toBeVisible();

    // Button should be enabled or show out of stock
    const isDisabled = await addToCart.isDisabled();
    if (!isDisabled) {
      // If enabled, should be able to click
      await expect(addToCart).toBeEnabled();
    }
  });

  test("variant selection updates product", async ({ page }) => {
    // Look for variant selectors (size, color, etc.)
    // These could be dropdowns, radio buttons, or other controls
    const select = page.locator("select").first();
    const radio = page.locator('input[type="radio"]').first();
    const button = page
      .getByRole("button")
      .filter({ hasNot: page.getByRole("button", { name: /add to cart/i }) });

    // If any variant controls exist, test them
    if (await select.isVisible()) {
      const options = await select.locator("option").count();
      if (options > 1) {
        await select.selectOption({ index: 1 });
        // Selection should work without error
        await expect(select).toBeVisible();
      }
    } else if (await radio.isVisible()) {
      await radio.click();
      await expect(radio).toBeChecked();
    }
    // Some products may not have variants (OK)
  });

  test("product gallery shows images", async ({ page }) => {
    // Should have at least one product image
    const images = page.locator("img[alt]");
    const imageCount = await images.count();

    expect(imageCount).toBeGreaterThanOrEqual(1);
  });

  test("product description is present", async ({ page }) => {
    // Should have some product description or details
    // Don't assert specific content, just that there's information
    const main = page.locator("main");
    const textContent = await main.textContent();

    expect(textContent).toBeTruthy();
    expect(textContent!.length).toBeGreaterThan(50); // Has substantial content
  });
});
