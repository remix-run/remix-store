import { expect, test } from "playwright/test";

test("catalog navigation works without JavaScript", async ({ page }) => {
  let response = await page.goto("/collections/all");

  expect(response?.status()).toBe(200);
  let productLink = page.locator('main a[href^="/products/"]').first();
  let productName = (await productLink.locator("h3").innerText()).trim();
  await expect(productLink).toBeVisible();
  await productLink.click();

  await expect(page).toHaveURL(/\/products\//);
  await expect(
    page.getByRole("heading", { level: 1, name: productName }),
  ).toBeVisible();
});
