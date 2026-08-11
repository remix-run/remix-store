import { expect, test } from "playwright/test";

import { openAvailableProduct } from "./storefront.ts";

test("catalog navigation and add-to-cart work without JavaScript", async ({
  page,
}) => {
  let { addToCart, title } = await openAvailableProduct(page);
  let form = page
    .locator('form[action="/api/cart"]')
    .filter({ has: addToCart });

  await expect(form).toBeVisible();

  await Promise.all([page.waitForURL(/\/products\//), addToCart.click()]);

  // The native cart POST redirects back to the product page and persists the
  // cart cookie, so the server-rendered cart page must contain the added item.
  await expect(addToCart).toBeVisible();
  await page.goto("/cart");
  await expect(page.getByRole("heading", { name: /cart/i }).first()).toBeVisible();
  await expect(
    page.locator("main").getByText(title, { exact: true }).first(),
  ).toBeVisible();
});
