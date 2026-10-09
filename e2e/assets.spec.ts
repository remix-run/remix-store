import { expect, test } from "playwright/test";

test("serves document assets and preserves every rendered hydration export", async ({
  page,
  request,
}) => {
  let errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  let response = await request.get("/products/test-product");
  expect(response.ok()).toBe(true);
  let html = await response.text();
  await page.goto("/products/test-product");

  let assets = await page.evaluate(async (html) => {
    // The browser runtime consumes/removes the live hydration record.
    let documentData = new DOMParser().parseFromString(html, "text/html");
    let data = JSON.parse(
      documentData.getElementById("rmx-data")!.textContent!,
    );
    let records = Object.values(data.h) as Array<{
      moduleUrl: string;
      exportName: string;
    }>;
    if (!records.length) throw new Error("No hydration records rendered");
    // Exercise the real output modules rather than pinning generated filenames.
    for (let record of records) {
      let module = await import(record.moduleUrl);
      if (typeof module[record.exportName] !== "function")
        throw new Error(
          `Missing hydration export ${record.moduleUrl}#${record.exportName}`,
        );
    }
    return {
      islands: records.map((record) => record.moduleUrl),
      stylesheets: [
        ...documentData.querySelectorAll<HTMLLinkElement>(
          'link[rel="stylesheet"]',
        ),
      ].map(
        (link) =>
          new URL(link.getAttribute("href")!, window.location.href).href,
      ),
      fonts: [
        ...documentData.querySelectorAll<HTMLLinkElement>('link[as="font"]'),
      ].map(
        (link) =>
          new URL(link.getAttribute("href")!, window.location.href).href,
      ),
      preloads: [
        ...documentData.querySelectorAll<HTMLLinkElement>(
          'link[rel="modulepreload"]',
        ),
      ].map(
        (link) =>
          new URL(link.getAttribute("href")!, window.location.href).href,
      ),
    };
  }, html);

  expect(assets.stylesheets.length).toBeGreaterThan(0);
  expect(assets.fonts.length).toBeGreaterThan(0);
  for (let [hrefs, contentType] of [
    [assets.stylesheets, "text/css"],
    [assets.fonts, "font/woff2"],
  ] as const) {
    for (let href of hrefs) {
      let response = await request.get(href, {
        headers: { Accept: contentType },
      });
      expect(response.ok(), href).toBe(true);
      expect(response.headers()["content-type"], href).toContain(contentType);
    }
  }
  if (process.env.E2E_RUNTIME !== "oxygen-dev") {
    for (let href of assets.islands) {
      expect(assets.preloads).toContain(new URL(href, page.url()).href);
    }
  }
  expect(errors).toEqual([]);
});
