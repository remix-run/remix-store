import { expect, test } from "playwright/test";

import { openAvailableProduct } from "./storefront.ts";

test.skip("catalog navigation and add-to-cart work without JavaScript", async ({
  page,
}) => {
  let { addToCart } = await openAvailableProduct(page);
  let form = page.locator('form[action="/cart"]').filter({ has: addToCart });

  await expect(form).toBeVisible();

  await Promise.all([page.waitForURL(/\/cart(?:\?|$)/), addToCart.click()]);

  await expect(
    page.getByRole("heading", { name: /cart/i }).first(),
  ).toBeVisible();
  await expect(page.getByText(/subtotal/i)).toBeVisible();
});
