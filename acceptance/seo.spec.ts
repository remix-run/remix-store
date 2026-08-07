import { test, expect } from "@playwright/test";

/**
 * SEO acceptance tests
 * Validates: robots.txt, sitemap.xml, meta tags
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("SEO Assets", () => {
  test("robots.txt is accessible and valid", async ({ page }) => {
    const response = await page.goto("/robots.txt");

    expect(response?.status()).toBe(200);

    const content = await page.textContent("body");

    // Should contain valid robots.txt directives
    expect(content).toMatch(/User-agent:/i);

    // Should reference sitemap
    expect(content).toMatch(/Sitemap:/i);
  });

  test("sitemap.xml is accessible and valid", async ({ page }) => {
    const response = await page.goto("/sitemap.xml");

    expect(response?.status()).toBe(200);

    // Should be XML
    expect(response?.headers()["content-type"]).toMatch(/xml/);

    const content = await page.textContent("body");

    // Should contain XML namespace and URLs
    expect(content).toMatch(/<urlset/);
    expect(content).toMatch(/<loc>/);
  });

  test("home page has proper meta tags", async ({ page }) => {
    await page.goto("/");

    // Should have title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);

    // Should have description meta tag
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();

    // Should have Open Graph tags
    const ogTitle = await page
      .locator('meta[property="og:title"]')
      .getAttribute("content");
    expect(ogTitle).toBeTruthy();
  });

  test("product pages have proper meta tags", async ({ page }) => {
    // Navigate to a product
    await page.goto("/collections/all");
    const firstProduct = page
      .getByRole("link")
      .filter({
        has: page.locator("img[alt]"),
      })
      .first();
    await firstProduct.click();
    await page.waitForURL(/\/products\//);

    // Should have unique title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title.toLowerCase()).not.toBe("remix store");

    // Should have description
    const description = await page
      .locator('meta[name="description"]')
      .getAttribute("content");
    expect(description).toBeTruthy();

    // Should have og:image for product
    const ogImage = await page
      .locator('meta[property="og:image"]')
      .getAttribute("content");
    expect(ogImage).toBeTruthy();
    expect(ogImage).toMatch(/^https?:\/\//);
  });
});
