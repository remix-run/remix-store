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
