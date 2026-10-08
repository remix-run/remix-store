import { expect, test, type Page } from "playwright/test";

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

test("updates the product grid when navigating between collections", async ({
  page,
}) => {
  await page.goto("/collections/all");
  // The browser runtime removes the hydration record once it takes over links.
  await page.waitForFunction(() => !document.getElementById("rmx-data"));
  await page.evaluate(() => {
    (window as { documentMarker?: boolean }).documentMarker = true;
  });

  let grid = page.getByRole("region", { name: "Collection products" });
  await expect(grid.locator('a[href="/products/test-product"]')).toBeVisible();

  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Apparel" })
    .click();

  await expect(page).toHaveURL(/\/collections\/apparel$/);
  await expect(
    grid.locator('a[href="/products/apparel-product"]'),
  ).toBeVisible();
  await expect(grid.locator('a[href="/products/test-product"]')).toHaveCount(0);
  // The grid must update through client navigation, not a document reload.
  expect(
    await page.evaluate(
      () => (window as { documentMarker?: boolean }).documentMarker,
    ),
  ).toBe(true);
});

test("loads the next page of products in place and retries failures", async ({
  page,
}) => {
  await page.goto("/collections/all");
  await page.waitForFunction(() => !document.getElementById("rmx-data"));
  let historyLength = await page.evaluate(() => history.length);

  let failedOnce = false;
  await page.route("**/collections/all/products?*", (route) => {
    if (failedOnce) return route.continue();
    failedOnce = true;
    return route.abort();
  });

  let grid = page.getByRole("region", { name: "Collection products" });
  let loadMore = grid.getByRole("button", { name: "Load more" });
  await loadMore.click();
  await expect(grid.getByRole("alert")).toHaveText(
    "Products could not be loaded. Please try again.",
  );

  await loadMore.click();
  let nextProduct = grid.locator('a[href="/products/second-page-product"]');
  await expect(nextProduct).toBeVisible();
  await expect(nextProduct).toBeFocused();
  await expect(grid.locator('a[href="/products/test-product"]')).toBeVisible();
  await expect(grid.getByRole("alert")).toHaveCount(0);
  // The last page ends the grid.
  await expect(loadMore).toHaveCount(0);
  await expect(page).toHaveURL(/\/collections\/all$/);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
});

test.describe("mobile menu", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("opens as a native popover and dismisses like a menu", async ({
    page,
  }) => {
    await page.goto("/collections/all");
    await page.waitForFunction(() => !document.getElementById("rmx-data"));
    await page.evaluate(() => {
      (window as { documentMarker?: boolean }).documentMarker = true;
    });

    let toggle = page.getByRole("button", { name: "Navigation menu" });
    let nav = page.getByRole("navigation", { name: "Mobile navigation" });
    let links = nav.getByRole("link");

    expect(await accessibleExpanded(page, "Navigation menu")).toBe(false);
    await toggle.click();
    await expect(nav).toBeVisible();
    // The popover invoker exposes its state natively, without aria-expanded.
    expect(await accessibleExpanded(page, "Navigation menu")).toBe(true);

    // Escape returns focus to the toggle.
    await page.keyboard.press("Tab");
    await expect(links.first()).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(nav).toBeHidden();
    await expect(toggle).toBeFocused();

    // An outside click dismisses it.
    await toggle.click();
    await expect(nav).toBeVisible();
    await page.mouse.click(20, 600);
    await expect(nav).toBeHidden();

    // Tabbing past the last link closes it.
    await toggle.click();
    for (let index = 0; index <= (await links.count()); index++) {
      await page.keyboard.press("Tab");
    }
    await expect(nav).toBeHidden();

    // Following a link closes it during client navigation.
    await toggle.click();
    await nav.getByRole("link", { name: "Apparel" }).click();
    await expect(page).toHaveURL(/\/collections\/apparel$/);
    await expect(nav).toBeHidden();
    expect(
      await page.evaluate(
        () => (window as { documentMarker?: boolean }).documentMarker,
      ),
    ).toBe(true);
  });
});

test.describe("mobile menu dismissal", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("a tap outside closes the menu without following a link", async ({
    page,
  }) => {
    await page.goto("/collections/all");
    await page.waitForFunction(() => !document.getElementById("rmx-data"));

    let toggle = page.getByRole("button", { name: "Navigation menu" });
    let nav = page.getByRole("navigation", { name: "Mobile navigation" });
    let product = page
      .getByRole("region", { name: "Collection products" })
      .getByRole("link")
      .first();

    await toggle.tap();
    await expect(nav).toBeVisible();
    await product.tap();
    await expect(nav).toBeHidden();
    await expect(page).toHaveURL(/\/collections\/all$/);

    await product.tap();
    await expect(page).toHaveURL(/\/products\/test-product$/);
  });
});

// Playwright's role engine does not derive popover invoker state, so read
// Chromium's accessibility tree instead.
async function accessibleExpanded(page: Page, name: string) {
  let cdp = await page.context().newCDPSession(page);
  let { nodes } = await cdp.send("Accessibility.getFullAXTree");
  let node = nodes.find((candidate) => candidate.name?.value === name);
  return node?.properties?.find((property) => property.name === "expanded")
    ?.value.value;
}

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

test("a bare product URL shows its selected options without a new history entry", async ({
  page,
}) => {
  let hydrated = () =>
    page.waitForFunction(() => !document.getElementById("rmx-data"));

  await page.goto("/products/sized-product");
  await expect(page).toHaveURL(/\/products\/sized-product\?Size=Small$/);
  expect(await page.evaluate(() => history.length)).toBe(2);

  // An existing query is the shopper's choice, and a product without real
  // options has nothing to show.
  await page.goto("/products/sized-product?utm_source=test");
  await hydrated();
  await expect(page).toHaveURL(/\?utm_source=test$/);
  await page.goto("/products/test-product");
  await hydrated();
  await expect(page).toHaveURL(/\/products\/test-product$/);
});

test.describe("mobile product gallery", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test("skips to an image from its dot", async ({ page }) => {
    await page.goto("/products/sized-product");
    let gallery = page.getByRole("region", { name: "Product images" });
    let second = gallery.getByRole("button", { name: "Skip to image 2" });
    let previous = gallery.getByRole("button", { name: "Previous image" });
    await expect(previous).toBeDisabled();

    await second.tap();

    await expect(second).toHaveAttribute("aria-current", "true");
    await expect(previous).toBeEnabled();
  });
});

test("adds a product to the cart from the product page", async ({ page }) => {
  await page.goto("/products/test-product");
  await page.evaluate(async () => {
    let entry = document.querySelector<HTMLScriptElement>(
      'script[type="module"]',
    );
    if (!entry?.src) throw new Error("Browser entry module was not found");
    await import(entry.src);
  });

  await Promise.all([
    page.waitForResponse((response) => {
      return (
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST"
      );
    }),
    page.getByRole("button", { name: "Add to cart" }).click(),
  ]);
  // The check confirms the add before the button is usable again.
  await expect(
    page.getByRole("button", { name: "Added to cart" }),
  ).toBeDisabled();
  await expect(page.getByRole("button", { name: "Add to cart" })).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "1 Item in cart" }),
  ).toBeVisible();

  await page.goto("/cart");

  await expect(
    page.getByRole("heading", { name: "1 item(s) in cart" }),
  ).toBeVisible();
});
