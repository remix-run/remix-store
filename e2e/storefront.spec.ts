import { expect, test } from "playwright/test";

import { openAvailableProduct } from "./storefront.ts";

test("renders the current storefront skeleton", async ({ page }) => {
  let response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /hydration check: 0/i }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue(
        "--color-blue-brand",
      ),
    ),
  ).toBe("#20aaff");
  expect(
    await page.evaluate(() => getComputedStyle(document.body).fontFamily),
  ).toContain("Inter");
});

test("returns a real branded 404 response and navigates home", async ({
  page,
}) => {
  let runtimeErrors: string[] = [];
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  let response = await page.goto("/this-route-must-not-exist");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  runtimeErrors.length = 0;

  await page.getByRole("link", { name: "Return home" }).click();

  await expect(page).toHaveURL("/");
  await expect(
    page.getByRole("button", { name: /hydration check: 0/i }),
  ).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL("/this-route-must-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test.skip("renders the storefront shell and catalog entry point", async ({
  page,
}) => {
  let response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("footer")).toBeVisible();
  await expect(
    page.locator('a[href*="/collections/all"]').first(),
  ).toBeVisible();
});

test.skip("navigates from the catalog to a product", async ({ page }) => {
  await page.goto("/collections/all");

  let productLink = page.locator('main a[href*="/products/"]').first();
  await expect(productLink).toBeVisible();
  let productName = (await productLink.innerText()).trim();

  await productLink.click();

  await expect(page).toHaveURL(/\/products\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(productName);
  await expect(
    page.getByRole("button", { name: /add to cart|sold out/i }),
  ).toBeVisible();
});

test.skip("adds an available product to the cart", async ({ page }) => {
  let { addToCart, title } = await openAvailableProduct(page);

  let [cartResponse] = await Promise.all([
    page.waitForResponse((response) => {
      let url = new URL(response.url());
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

test.skip("serves SEO resources", async ({ request }) => {
  let robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain("User-agent:");

  let sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  expect(await sitemap.text()).toMatch(/<(sitemapindex|urlset)[\s>]/);
});
