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

test("keeps the migrated medium layout through 1399px", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");

  let heroHeading = page.getByRole("heading", {
    name: "Remix 3 Racing Team Collection",
  });
  let homeGrid = page.locator('section[aria-label="Collection products"] > ul');
  let homeCatalog = page.locator("[data-home-catalog]");
  await expect(heroHeading).toHaveCSS("font-size", "64px");
  await expect(homeGrid).toHaveCSS("padding", "0px");
  await expect(homeCatalog).toHaveCSS("padding", "48px 0px");

  await page.goto("/collections/all");
  let collectionGrid = page.locator(
    'section[aria-label="Collection products"] > ul',
  );
  await expect(collectionGrid).toHaveCSS("padding", "0px");

  await page.goto("/products/test-product");
  await expect(
    page.getByRole("navigation", { name: "Product collections" }),
  ).toBeHidden();
  await expect(page.locator("main h1")).toHaveCSS("font-size", "24px");
  await expect(page.locator('button[name="add-to-cart"]')).toHaveCSS(
    "height",
    "64px",
  );
  await expect(page.getByText("This water bottle", { exact: true })).toHaveCSS(
    "font-size",
    "12px",
  );
  await expect(page.getByText("This water bottle", { exact: true })).toHaveCSS(
    "line-height",
    "16px",
  );
  await expect(page.getByText("Nalgene 32 oz.", { exact: true })).toHaveCSS(
    "font-size",
    "12px",
  );

  let footerBrand = page.locator('footer svg[aria-label="Remix Logo"]');
  await expect(footerBrand).toHaveCSS("width", "216px");
  await expect(page.locator("[data-footer-brand]")).toHaveCSS(
    "flex-direction",
    "column",
  );
});

test("switches product and footer chrome at the 1400px breakpoint", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/products/test-product");

  await expect(
    page.getByRole("navigation", { name: "Product collections" }),
  ).toBeVisible();
  await expect(page.locator("main h1")).toHaveCSS("font-size", "36px");
  await expect(page.locator('button[name="add-to-cart"]')).toHaveCSS(
    "height",
    "66px",
  );
  await expect(page.getByText("This water bottle", { exact: true })).toHaveCSS(
    "font-size",
    "16px",
  );
  await expect(page.getByText("This water bottle", { exact: true })).toHaveCSS(
    "line-height",
    "22.4px",
  );

  let footerBrand = page.locator('footer svg[aria-label="Remix Logo"]');
  await expect(footerBrand).toHaveCSS("width", "260px");
  await expect(page.locator("[data-footer-brand]")).toHaveCSS(
    "flex-direction",
    "row",
  );
});

test("matches shared image, control, cart, and mobile footer dimensions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/collections/all");

  let productImage = page
    .locator('section[aria-label="Collection products"] img')
    .first();
  let imageDimensions = await productImage.evaluate((image) => ({
    image: image.getBoundingClientRect().width,
    region: image.parentElement?.getBoundingClientRect().width,
  }));
  expect(imageDimensions.image).toBe(imageDimensions.region);
  await expect(productImage).toHaveCSS("object-fit", "cover");

  let loadMore = page.getByRole("button", { name: "Load more" });
  await expect(loadMore).toHaveCSS("height", "100px");
  await expect(loadMore).toHaveCSS("line-height", "28px");

  await page.goto("/");
  await expect(page.getByRole("link", { name: "Shop New Items" })).toHaveCSS(
    "line-height",
    "28px",
  );

  await page.goto("/products/test-product");
  let addToCart = page.getByRole("button", { name: "Add to cart" });
  await Promise.all([
    page.waitForResponse((response) => {
      return (
        new URL(response.url()).pathname === "/api/cart" &&
        response.request().method() === "POST"
      );
    }),
    addToCart.click(),
  ]);
  await page.goto("/cart");

  let cartCount = page.getByRole("heading", { name: "1 item(s) in cart" });
  await expect(cartCount).toHaveCSS("line-height", "28px");
  await expect(page.locator("main > section")).toHaveCSS(
    "padding-bottom",
    "0px",
  );

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(cartCount).toHaveCSS("line-height", "22.4px");
  expect(
    await page.locator("[data-footer-content] > div").evaluate((footer) => {
      let availableWidth = footer.parentElement?.clientWidth ?? 0;
      return footer.getBoundingClientRect().width <= availableWidth;
    }),
  ).toBe(true);
});
