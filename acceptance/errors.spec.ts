import { test, expect } from "@playwright/test";

/**
 * Error Page acceptance tests
 * Validates: 404 pages, error handling
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("Error Pages", () => {
  test("404 page displays for non-existent routes", async ({ page }) => {
    const response = await page.goto("/this-page-does-not-exist-12345");

    // Should return 404
    expect(response?.status()).toBe(404);

    // Should show 404 content
    const content = await page.textContent("body");
    expect(content).toMatch(/404|not found|page.*not.*exist/i);
  });

  test("404 page maintains navigation", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-12345");

    // Should still have header/navigation
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible();

    // Should have link back to home or collections
    const homeLink = page
      .getByRole("link", { name: /home|shop|collections/i })
      .first();
    await expect(homeLink).toBeVisible();
  });

  test("404 page is accessible", async ({ page }) => {
    await page.goto("/this-page-does-not-exist-12345");

    // Should have meaningful heading
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toBeVisible();

    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
  });

  test("non-existent product shows 404", async ({ page }) => {
    const response = await page.goto(
      "/products/this-product-does-not-exist-xyz123",
    );

    // Should return 404
    expect(response?.status()).toBe(404);
  });

  test("non-existent collection shows 404", async ({ page }) => {
    const response = await page.goto(
      "/collections/this-collection-does-not-exist-xyz123",
    );

    // Should return 404
    expect(response?.status()).toBe(404);
  });
});
