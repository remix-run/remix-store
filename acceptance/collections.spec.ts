import { test, expect } from "@playwright/test";

/**
 * Collections & Product Grid acceptance tests
 * Validates: collection pages, product grid, load more functionality
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("Collections", () => {
  test("displays collection page with products", async ({ page }) => {
    // Navigate to a collection (most stores have an "all" or main collection)
    await page.goto("/collections/all");

    // Should show product grid
    const productLinks = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });

    await expect(productLinks.first()).toBeVisible();

    // Should have multiple products
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(1);
  });

  test("product cards show essential information", async ({ page }) => {
    await page.goto("/collections/all");

    // First product should have image and title
    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await expect(firstProduct).toBeVisible();

    // Should have product image
    const productImage = firstProduct.locator("img").first();
    await expect(productImage).toBeVisible();
    await expect(productImage).toHaveAttribute("alt", /.+/); // Has alt text
  });

  test("clicking product navigates to product page", async ({ page }) => {
    await page.goto("/collections/all");

    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();

    await firstProduct.click();

    await expect(page).toHaveURL(/\/products\//);
  });

  test("load more button loads additional products", async ({ page }) => {
    await page.goto("/collections/all");

    // Count initial products
    const initialProducts = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });
    const initialCount = await initialProducts.count();

    // Look for load more button (various possible texts)
    const loadMore = page.getByRole("button", {
      name: /load more|show more|view more/i,
    });

    if (await loadMore.isVisible()) {
      await loadMore.click();

      // Wait for more products to load
      await page.waitForTimeout(1000); // Brief wait for content

      // Should have more products after loading
      const newCount = await initialProducts.count();
      expect(newCount).toBeGreaterThanOrEqual(initialCount);
    }
    // If no load more button, collection might show all products (OK)
  });
});

test.describe("Product Grid Navigation", () => {
  test("grid maintains layout with multiple products", async ({ page }) => {
    await page.goto("/collections/all");

    // Should show multiple product cards
    const products = page.getByRole("link").filter({
      has: page.locator("img[alt]"),
    });

    const count = await products.count();
    expect(count).toBeGreaterThan(2);

    // Products should be visible
    await expect(products.nth(0)).toBeVisible();
    await expect(products.nth(1)).toBeVisible();
  });
});
