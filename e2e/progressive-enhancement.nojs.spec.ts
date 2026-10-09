import { expect, test } from "playwright/test";

import { openAvailableProduct } from "./storefront.ts";

test("localized catalog navigation and add-to-cart work without JavaScript", async ({
  page,
}) => {
  await page.goto("/en-ca/collections/all");
  let productLink = page.locator('main a[href^="/en-ca/products/"]').first();
  await productLink.click();
  let addToCart = page.getByRole("button", { name: "Add to cart" });
  let title = await page.locator("main h1").innerText();
  let form = page
    .locator('form[action="/en-ca/api/cart"]')
    .filter({ has: addToCart });
  await expect(form).toBeVisible();

  let [cartResponse] = await Promise.all([
    page.waitForResponse(
      (response) => new URL(response.url()).pathname === "/en-ca/api/cart",
    ),
    addToCart.click(),
  ]);
  expect(cartResponse.status()).toBe(303);
  await expect(page).toHaveURL(/\/en-ca\/products\//);
  await page.goto("/en-ca/cart");
  await expect(
    page.locator("main").getByText(title, { exact: true }).first(),
  ).toBeVisible();
});

test.describe("mobile menu without JavaScript", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens, dismisses, and navigates", async ({ page }) => {
    await page.goto("/collections/all");
    let toggle = page.getByRole("button", { name: "Navigation menu" });
    let nav = page.getByRole("navigation", { name: "Mobile navigation" });

    await toggle.click();
    await expect(nav).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();

    await toggle.click();
    await nav.getByRole("link", { name: "Apparel" }).click();
    await expect(page).toHaveURL(/\/collections\/apparel$/);
  });
});

test("load more opens the next page of products without JavaScript", async ({
  page,
}) => {
  await page.goto("/collections/all");
  await page.getByRole("button", { name: "Load more" }).click();

  await expect(page).toHaveURL(/\/collections\/all\?cursor=next-page$/);
  await expect(
    page.locator('main a[href="/products/second-page-product"]'),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Load more" })).toHaveCount(0);
});

test("catalog navigation and add-to-cart work without JavaScript", async ({
  page,
}) => {
  let { addToCart, title } = await openAvailableProduct(page);
  let form = page
    .locator('form[action="/api/cart"]')
    .filter({ has: addToCart });

  await expect(form).toBeVisible();

  let [cartResponse] = await Promise.all([
    page.waitForResponse((response) => {
      return (
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST"
      );
    }),
    addToCart.click(),
  ]);

  // The native cart POST redirects back to the product page and persists the
  // cart cookie, so the server-rendered cart page must contain the added item.
  expect(cartResponse.status()).toBe(303);
  await expect(page).toHaveURL(/\/products\//);
  await expect(addToCart).toBeVisible();
  await page.goto("/cart");
  await expect(
    page.getByRole("heading", { name: /cart/i }).first(),
  ).toBeVisible();
  await expect(
    page.locator("main").getByText(title, { exact: true }).first(),
  ).toBeVisible();
});
