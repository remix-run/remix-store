import { expect, test } from "playwright/test";

import { openAvailableProduct } from "./storefront.ts";

test("renders the current storefront skeleton", async ({ page }) => {
  let response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Remix 3 Racing Team Collection" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Shop New Items" }),
  ).toBeVisible();
});

test("keeps product details when navigating from the home page", async ({
  page,
}) => {
  await page.goto("/");

  let productRegion = page
    .locator('main section[aria-label]:has(a[href^="/products/"])')
    .first();
  let productName = await productRegion.locator("h3").innerText();
  expect(productName).toBeTruthy();

  await productRegion.locator('a[href^="/products/"]').click();

  await expect(page).toHaveURL(/\/products\//);
  await expect(page.locator("main h1")).toHaveText(productName);
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
    page.getByRole("heading", { name: "Remix 3 Racing Team Collection" }),
  ).toBeVisible();

  await page.goBack();

  await expect(page).toHaveURL("/this-route-must-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});

test("renders the storefront shell and catalog entry point", async ({
  page,
}) => {
  let response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("link", { name: "Remix Store home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeAttached();
  await expect(page.locator("footer")).toBeVisible();
  await expect(
    page.locator('a[href*="/collections/all"]').first(),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new RegExp("/$"),
  );
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp("/social-main\\.jpg$"),
  );
});

test("navigates from the catalog to a product", async ({ page }) => {
  await page.goto("/collections/all");

  let productLink = page.locator('main a[href*="/products/"]').first();
  await expect(productLink).toBeVisible();
  let productName = (await productLink.locator("h3").innerText()).trim();

  await productLink.click();

  await expect(page).toHaveURL(/\/products\//);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(productName);
  await expect(
    page.getByRole("button", { name: /add to cart|sold out/i }),
  ).toBeVisible();
});

test("product pages preserve their canonical URL", async ({ page }) => {
  await page.goto("/collections/all");
  let productPath = await page
    .locator('main a[href^="/products/"]')
    .first()
    .getAttribute("href");
  expect(productPath).toBeTruthy();
  await page.goto(`${productPath}?utm_source=test`);

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    new URL(productPath!, page.url()).href,
  );
});

test("adds a product without opening the cart, then opens it on request", async ({
  page,
}) => {
  let { addToCart, title } = await openAvailableProduct(page);

  let [cartResponse] = await Promise.all([
    page.waitForResponse((response) => {
      let url = new URL(response.url());
      return (
        url.pathname.startsWith("/api/cart") &&
        response.request().method() === "POST"
      );
    }),
    addToCart.click(),
  ]);
  expect(cartResponse.ok()).toBe(true);

  let drawer = page.getByRole("dialog", { name: /item\(s\) in cart/i });
  await expect(drawer).not.toBeVisible();
  let cartTrigger = page.getByRole("button", { name: /1 item in cart/i });
  await expect(cartTrigger).toBeVisible();

  await cartTrigger.click();
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(title, { exact: true }).first()).toBeVisible();
  await expect(drawer.getByText(/subtotal/i)).toBeVisible();

  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /cart/i }).first()).toBeVisible();
  await expect(
    page.locator("main").getByText(title, { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator("main").getByText(/subtotal/i)).toBeVisible();
});
