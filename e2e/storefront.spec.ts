import { expect, test } from "@playwright/test";
import { openAvailableProduct } from "./storefront";

test("renders the storefront shell and catalog entry point", async ({
  page,
}) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator("footer")).toBeVisible();
  await expect(
    page.locator('a[href*="/collections/all"]').first(),
  ).toBeVisible();
});

test("navigates from the catalog to a product", async ({ page }) => {
  await page.goto("/collections/all");

  const productLink = page.locator('main a[href*="/products/"]').first();
  await expect(productLink).toBeVisible();
  const productName = (await productLink.innerText()).trim();

  await productLink.click();

  await expect(page).toHaveURL(/\/products\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(productName);
  await expect(
    page.getByRole("button", { name: /add to cart|sold out/i }),
  ).toBeVisible();
});

test("adds an available product to the cart", async ({ page }) => {
  const { addToCart, title } = await openAvailableProduct(page);

  const [cartResponse] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname.startsWith("/cart") &&
        response.request().method() === "POST"
      );
    }),
    addToCart.click(),
  ]);
  expect(cartResponse.ok()).toBe(true);

  await page.goto("/cart");

  await expect(
    page.getByRole("heading", { name: /cart/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/subtotal/i)).toBeVisible();
});

test("serves SEO resources and a real 404 response", async ({
  page,
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("User-agent:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toMatch(/<(sitemapindex|urlset)[\s>]/);

  const notFound = await page.goto("/this-route-must-not-exist");
  expect(notFound?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
});
