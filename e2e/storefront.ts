import { expect, type Page } from "playwright/test";

export async function openAvailableProduct(page: Page) {
  await page.goto("/collections/all");

  let paths = await page
    .locator('main a[href*="/products/"]')
    .evaluateAll((links) =>
      links
        .map((link) => link.getAttribute("href"))
        .filter((href): href is string => Boolean(href)),
    );
  let uniquePaths = [...new Set(paths)];

  expect(
    uniquePaths.length,
    "the catalog should contain products",
  ).toBeGreaterThan(0);

  for (let path of uniquePaths.slice(0, 10)) {
    await page.goto(path);
    let addToCart = page.getByRole("button", { name: /add to cart/i });

    if ((await addToCart.isVisible()) && (await addToCart.isEnabled())) {
      let title = await page.getByRole("heading", { level: 1 }).innerText();
      return { addToCart, title };
    }
  }

  throw new Error("No available product found in the first 10 catalog items");
}
