import { expect, test } from "playwright/test";

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

test("keeps the Canadian market through navigation, cart, money, and metadata", async ({
  page,
}) => {
  let response = await page.goto("/en-ca/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/en-ca\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-CA");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/en-ca\/$/,
  );
  await expect(
    page.locator('main a[href^="/en-ca/products/"]').first(),
  ).toBeVisible();

  await page.locator('main a[href^="/en-ca/products/"]').first().click();
  await expect(page).toHaveURL(/\/en-ca\/products\/test-product/);
  await expect(page.locator("main")).toContainText("$20.00");
  expect(await page.evaluate(() => window.Shopify?.currency?.active)).toBe(
    "CAD",
  );
  let cartResponse = await page.request.post("/en-ca/api/cart", {
    form: {
      merchandiseId: "gid://shopify/ProductVariant/111",
      quantity: "1",
    },
    headers: { Accept: "text/html", Referer: page.url() },
  });
  expect(cartResponse.ok()).toBe(true);
  await page.goto("/en-ca/cart");
  await expect(page.locator("main")).toContainText("$10.00");
});

test("canonical locale aliases redirect and unsupported locale paths 404", async ({
  request,
}) => {
  let us = await request.get("/en-us/products/test-product?ref=test", {
    maxRedirects: 0,
  });
  expect(us.status()).toBe(308);
  expect(us.headers().location).toBe("/products/test-product?ref=test");

  let ca = await request.get("/fr-ca/products/test-product?ref=test", {
    maxRedirects: 0,
  });
  expect(ca.status()).toBe(308);
  expect(ca.headers().location).toBe("/en-ca/products/test-product?ref=test");

  let unsupported = await request.get("/de-de/products/test-product");
  expect(unsupported.status()).toBe(404);
  expect(await unsupported.text()).toContain("Page not found");
});

test("renders the active sale and labels cart allocations", async ({
  page,
}) => {
  await page.goto("/");

  let marquee = page.locator("[data-store-wide-sale]");
  await expect(marquee).toBeVisible();
  await expect(marquee.locator("p")).toHaveText("Sale. Now. Ends Jun.2.");
  let marqueeTrack = marquee.locator('[aria-hidden="true"]');
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(marqueeTrack).toHaveCSS("animation-name", "none");

  let cartResponse = await page.request.post("/api/cart", {
    form: {
      merchandiseId: "gid://shopify/ProductVariant/111",
      quantity: "1",
    },
    headers: { Accept: "text/html", Referer: page.url() },
  });
  expect(cartResponse.ok()).toBe(true);
  await page.goto("/cart");

  let cartSummary = page.locator("main");
  await expect(cartSummary.getByText("Sale", { exact: true })).toBeVisible();
  await expect(cartSummary.getByText("-$2.00", { exact: true })).toBeVisible();
});

test("serves cart permalink, discount, and admin compatibility redirects", async ({
  request,
}) => {
  let permalink = await request.get("/cart/111:1?discount=LAUNCH", {
    maxRedirects: 0,
  });
  expect(permalink.status()).toBe(302);
  let permalinkLocation = new URL(permalink.headers().location!);
  expect(permalinkLocation.pathname).toBe("/cart/111:1");
  expect(permalinkLocation.searchParams.get("discount")).toBe("LAUNCH");

  let discount = await request.get(
    "/discount/LAUNCH?redirect=%2Fcollections%2Fall&utm_source=test",
    { maxRedirects: 0 },
  );
  expect(discount.status()).toBe(303);
  expect(discount.headers().location).toBe("/collections/all?utm_source=test");
  expect(discount.headers()["set-cookie"]).toContain("cart=");

  let admin = await request.get("/admin", { maxRedirects: 0 });
  expect(admin.status()).toBe(301);
  expect(new URL(admin.headers().location!).pathname).toBe("/admin");
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
  await expect(
    page.getByRole("heading", { exact: true, level: 1, name: productName }),
  ).toBeVisible();
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

test("adds a product to the cart from the product page", async ({ page }) => {
  await page.goto("/products/test-product");

  await Promise.all([
    page.waitForResponse((response) => {
      return (
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST"
      );
    }),
    page.getByRole("button", { name: "Add to cart" }).click(),
  ]);
  await page.goto("/cart");

  await expect(
    page.getByRole("heading", { name: "1 item(s) in cart" }),
  ).toBeVisible();
});
