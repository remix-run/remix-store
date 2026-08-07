#!/usr/bin/env tsx
/**
 * Phase 0.2: Production Behavior Snapshot
 *
 * Captures SEO/HTTP/redirect contract fixtures from shop.remix.run
 * or any arbitrary BASE_URL for comparison.
 *
 * Usage:
 *   pnpm capture-snapshot                    # Captures from production
 *   pnpm capture-snapshot --url https://...  # Captures from custom URL
 *   pnpm diff-snapshot --url https://...     # Compares against fixtures
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";
import { Window } from "happy-dom";

// ============================================================================
// Types
// ============================================================================

interface ResponseSnapshot {
  url: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  redirectChain?: string[];
  finalUrl?: string;
}

interface MetadataSnapshot {
  url: string;
  title: string | null;
  meta: Record<string, string>;
  og: Record<string, string>;
  twitter: Record<string, string>;
  canonical: string | null;
  alternates: Array<{ rel: string; href: string; hreflang?: string }>;
}

interface RedirectSnapshot {
  from: string;
  to: string;
  status: number;
  chain: string[];
}

interface SitemapEntry {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

interface ProductionSnapshot {
  capturedAt: string;
  baseUrl: string;

  // Core SEO artifacts
  robots: string;
  sitemapIndex: {
    url: string;
    sitemaps: Array<{ loc: string; lastmod?: string }>;
  };
  sitemaps: Record<string, SitemapEntry[]>;

  // Representative route metadata
  routes: {
    home: MetadataSnapshot;
    collections: MetadataSnapshot;
    product: MetadataSnapshot;
    collection: MetadataSnapshot;
    cart: MetadataSnapshot;
    policy: MetadataSnapshot;
    notFound: MetadataSnapshot;
  };

  // Response headers for key routes
  headers: {
    home: ResponseSnapshot;
    collections: ResponseSnapshot;
    product: ResponseSnapshot;
    cart: ResponseSnapshot;
    staticAsset: ResponseSnapshot;
  };

  // Redirect inventory
  redirects: {
    discount: RedirectSnapshot[];
    cartLines: RedirectSnapshot[];
    checkout: RedirectSnapshot[];
    admin: RedirectSnapshot[];
    myshopify: RedirectSnapshot[];
    localeRedirects: RedirectSnapshot[];
  };

  // Locale URL inventory
  locales: {
    discovered: string[];
    paths: string[];
    sitemapAlternates: Record<string, string[]>;
  };

  // Test metadata
  _testContract: {
    productHandle: string;
    productVariantId: string;
    unavailableCategories: Array<{
      category: string;
      reason: string;
    }>;
  };
}

// ============================================================================
// Configuration
// ============================================================================

const DEFAULT_BASE_URL = "https://shop.remix.run";
// Handle being run from either project root or worktree
const cwd = process.cwd();
const SNAPSHOT_DIR = cwd.endsWith("phase0-snapshots")
  ? cwd
  : path.join(cwd, "phase0-snapshots");
const SNAPSHOT_FILE = path.join(SNAPSHOT_DIR, "production-snapshot.json");

// Representative URLs to capture (product derived dynamically)
const REPRESENTATIVE_ROUTES = {
  home: "/",
  collections: "/collections",
  collection: "/collections/apparel",
  cart: "/cart",
  policy: "/policies/privacy-policy",
  notFound: "/this-route-does-not-exist-404-test",
} as const;

// Headers to capture (normalized)
const HEADERS_TO_CAPTURE = [
  "cache-control",
  "content-type",
  "content-security-policy",
  "x-frame-options",
  "strict-transport-security",
  "x-content-type-options",
  "referrer-policy",
  "permissions-policy",
  "vary",
  "etag",
  "age",
] as const;

// ============================================================================
// Normalization Utilities
// ============================================================================

/**
 * Normalizes a URL for comparison by:
 * - Sorting query parameters alphabetically
 * - Preserving protocol, host, path, and hash
 * - Stripping session-specific checkout parameters
 * - Not hiding changes to external domains
 */
function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // For checkout URLs, strip session-specific query params
    if (
      parsed.hostname.includes("checkout") ||
      parsed.pathname.includes("checkout")
    ) {
      // Strip session-specific parameters but preserve the path structure
      const params = new URLSearchParams(parsed.search);
      const sessionParams = ["_r", "_s", "_y", "key", "shop_pay_token"];

      sessionParams.forEach((param) => params.delete(param));

      const sortedParams = Array.from(params.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${value}`)
        .join("&");

      // Normalize checkout path segments (strip unique IDs)
      let normalizedPath = parsed.pathname;
      // Replace checkout session IDs with placeholder
      normalizedPath = normalizedPath.replace(
        /\/c\/[a-zA-Z0-9_-]+/,
        "/c/SESSION_ID",
      );
      normalizedPath = normalizedPath.replace(
        /\/cn\/[a-zA-Z0-9_-]+/,
        "/cn/SESSION_ID",
      );

      return `${parsed.origin}${normalizedPath}${sortedParams ? `?${sortedParams}` : ""}`;
    }

    // For non-checkout URLs, just sort query params
    const params = new URLSearchParams(parsed.search);
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&");

    return `${parsed.origin}${parsed.pathname}${sortedParams ? `?${sortedParams}` : ""}${parsed.hash}`;
  } catch {
    return url;
  }
}

/**
 * Normalizes HTTP headers by:
 * - Stripping CSP nonces (time-sensitive)
 * - Preserving all other header structure
 */
function normalizeHeaders(
  headers: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === "content-security-policy") {
      // Strip nonces but preserve CSP structure
      normalized[key] = value.replace(
        /'nonce-[a-f0-9]+'/g,
        "'nonce-NORMALIZED'",
      );
    } else {
      normalized[key] = value;
    }
  }

  return normalized;
}

/**
 * Normalizes sitemap entries by stripping lastmod timestamps
 */
function normalizeSitemapEntry(
  entry: SitemapEntry,
): Omit<SitemapEntry, "lastmod"> {
  const { lastmod, ...rest } = entry;
  return rest;
}

// ============================================================================
// Product Discovery
// ============================================================================

async function discoverProductContract(baseUrl: string): Promise<{
  handle: string;
  variantId: string;
}> {
  // Fetch sitemap to find a live product
  console.log("🔍 Discovering live product from sitemap...");

  const sitemapUrl = `${baseUrl}/sitemap/products/1.xml`;
  const response = await fetch(sitemapUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch products sitemap: ${response.status}`);
  }

  const xml = await response.text();
  const window = new Window();
  const document = window.document;
  document.write(xml);

  const urlElements = document.querySelectorAll("url > loc");
  if (urlElements.length === 0) {
    throw new Error("No products found in sitemap");
  }

  // Use the first product from the sitemap
  const firstProductUrl = urlElements[0]?.textContent?.trim();
  if (!firstProductUrl) {
    throw new Error("Invalid product URL in sitemap");
  }

  const handle = new URL(firstProductUrl).pathname.replace("/products/", "");

  console.log(`   Found product: ${handle}`);

  // Fetch the product page to extract a variant ID
  const productResponse = await fetch(`${baseUrl}/products/${handle}`);

  if (!productResponse.ok) {
    throw new Error(
      `Failed to fetch product ${handle}: ${productResponse.status}`,
    );
  }

  const html = await productResponse.text();

  // Parse HTML to find variant ID in cart form
  const productWindow = new Window();
  const productDocument = productWindow.document;
  productDocument.write(html);

  const cartFormInput = productDocument.querySelector(
    'input[name="cartFormInput"]',
  );
  if (!cartFormInput) {
    throw new Error("Could not find cart form input in product page");
  }

  const cartFormValue = (cartFormInput as unknown as HTMLInputElement).value;
  const cartData = JSON.parse(cartFormValue) as {
    inputs?: {
      lines?: Array<{
        selectedVariant?: { id?: string };
        merchandiseId?: string;
      }>;
    };
  };

  const variantId =
    cartData?.inputs?.lines?.[0]?.selectedVariant?.id ||
    cartData?.inputs?.lines?.[0]?.merchandiseId;

  if (!variantId || !variantId.startsWith("gid://shopify/ProductVariant/")) {
    throw new Error("Could not extract variant ID from product page");
  }

  // Extract numeric ID from GID
  const numericId = variantId.split("/").pop();

  console.log(`   Variant ID: ${numericId}`);

  return { handle, variantId: numericId || "" };
}

// ============================================================================
// Utilities
// ============================================================================

async function fetchWithRedirects(
  url: string,
  options: RequestInit = {},
): Promise<{ response: Response; chain: string[] }> {
  const chain: string[] = [url];
  let currentUrl = url;
  let response: Response;

  // Follow redirects manually to capture the chain
  while (true) {
    response = await fetch(currentUrl, {
      ...options,
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;

      // Resolve relative URLs
      const nextUrl = new URL(location, currentUrl).href;
      chain.push(nextUrl);
      currentUrl = nextUrl;
    } else {
      break;
    }
  }

  return { response, chain };
}

function extractHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const header of HEADERS_TO_CAPTURE) {
    const value = response.headers.get(header);
    if (value !== null) {
      headers[header] = value;
    }
  }

  return headers;
}

async function parseMetadata(
  html: string,
  url: string,
): Promise<MetadataSnapshot> {
  const window = new Window();
  const document = window.document;
  document.write(html);

  const title = document.querySelector("title")?.textContent?.trim() || null;

  const meta: Record<string, string> = {};
  const og: Record<string, string> = {};
  const twitter: Record<string, string> = {};
  const alternates: Array<{ rel: string; href: string; hreflang?: string }> =
    [];
  let canonical: string | null = null;

  // Extract meta tags
  document.querySelectorAll("meta").forEach((metaEl) => {
    const nameAttr = metaEl.getAttribute("name");
    const propertyAttr = metaEl.getAttribute("property");
    const contentAttr = metaEl.getAttribute("content");

    if (!contentAttr) return;

    // Standard meta tags
    if (
      nameAttr &&
      !nameAttr.startsWith("og:") &&
      !nameAttr.startsWith("twitter:")
    ) {
      meta[nameAttr] = contentAttr;
    }

    // Open Graph tags
    if (propertyAttr?.startsWith("og:")) {
      const ogKey = propertyAttr.replace("og:", "");
      og[ogKey] = contentAttr;
    }

    // Twitter tags
    if (
      nameAttr?.startsWith("twitter:") ||
      propertyAttr?.startsWith("twitter:")
    ) {
      const twitterKey = (nameAttr || propertyAttr || "").replace(
        "twitter:",
        "",
      );
      twitter[twitterKey] = contentAttr;
    }
  });

  // Extract link tags
  document.querySelectorAll("link").forEach((linkEl) => {
    const rel = linkEl.getAttribute("rel");
    const href = linkEl.getAttribute("href");

    if (!rel || !href) return;

    if (rel === "canonical") {
      canonical = href;
    } else if (rel === "alternate") {
      const hreflang = linkEl.getAttribute("hreflang");
      alternates.push({
        rel,
        href,
        ...(hreflang ? { hreflang } : {}),
      });
    }
  });

  return {
    url,
    title,
    meta,
    og,
    twitter,
    canonical,
    alternates,
  };
}

async function parseSitemap(xml: string): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  const window = new Window();
  const document = window.document;
  document.write(xml);

  document.querySelectorAll("url").forEach((urlEl) => {
    const loc = urlEl.querySelector("loc")?.textContent?.trim();
    const lastmod = urlEl.querySelector("lastmod")?.textContent?.trim();
    const changefreq = urlEl.querySelector("changefreq")?.textContent?.trim();
    const priority = urlEl.querySelector("priority")?.textContent?.trim();

    if (loc) {
      entries.push({
        loc,
        ...(lastmod ? { lastmod } : {}),
        ...(changefreq ? { changefreq } : {}),
        ...(priority ? { priority } : {}),
      });
    }
  });

  return entries;
}

async function parseSitemapIndex(
  xml: string,
): Promise<Array<{ loc: string; lastmod?: string }>> {
  const sitemaps: Array<{ loc: string; lastmod?: string }> = [];
  const window = new Window();
  const document = window.document;
  document.write(xml);

  document.querySelectorAll("sitemap").forEach((sitemapEl) => {
    const loc = sitemapEl.querySelector("loc")?.textContent?.trim();
    const lastmod = sitemapEl.querySelector("lastmod")?.textContent?.trim();

    if (loc) {
      sitemaps.push({
        loc,
        ...(lastmod ? { lastmod } : {}),
      });
    }
  });

  return sitemaps;
}

// ============================================================================
// Capture Functions
// ============================================================================

async function captureRobots(baseUrl: string): Promise<string> {
  const url = `${baseUrl}/robots.txt`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch robots.txt: ${response.status}`);
  }

  return await response.text();
}

async function captureSitemapIndex(baseUrl: string) {
  const url = `${baseUrl}/sitemap.xml`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap.xml: ${response.status}`);
  }

  const xml = await response.text();
  const sitemaps = await parseSitemapIndex(xml);

  return { url, sitemaps };
}

async function captureSitemaps(
  baseUrl: string,
  sitemapUrls: string[],
): Promise<Record<string, SitemapEntry[]>> {
  const sitemaps: Record<string, SitemapEntry[]> = {};

  for (const sitemapUrl of sitemapUrls) {
    const response = await fetch(sitemapUrl);

    if (!response.ok) {
      console.warn(`Failed to fetch sitemap ${sitemapUrl}: ${response.status}`);
      continue;
    }

    const xml = await response.text();
    const entries = await parseSitemap(xml);

    // Use the path as the key (e.g., "products-1")
    const key = new URL(sitemapUrl).pathname
      .replace("/sitemap/", "")
      .replace(".xml", "");
    sitemaps[key] = entries;
  }

  return sitemaps;
}

async function captureRouteMetadata(
  baseUrl: string,
  routes: Record<string, string>,
  productHandle: string,
): Promise<ProductionSnapshot["routes"]> {
  const metadata = {} as ProductionSnapshot["routes"];

  for (const [key, pathTemplate] of Object.entries(routes)) {
    const path = pathTemplate.replace(":handle", productHandle);
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetch(url);

      if (!response.ok && key === "product") {
        throw new Error(
          `Product route failed: ${url} returned ${response.status}. ` +
            `Ensure productHandle "${productHandle}" exists.`,
        );
      }

      const html = await response.text();

      metadata[key as keyof typeof metadata] = await parseMetadata(html, url);
    } catch (error) {
      if (key === "product" || key === "notFound") {
        // Re-throw for critical routes
        throw error;
      }

      console.warn(`Failed to capture metadata for ${key} (${url}):`, error);
      metadata[key as keyof typeof metadata] = {
        url,
        title: null,
        meta: {},
        og: {},
        twitter: {},
        canonical: null,
        alternates: [],
      };
    }
  }

  return metadata;
}

async function captureResponseHeaders(
  baseUrl: string,
  productHandle: string,
): Promise<ProductionSnapshot["headers"]> {
  const headers = {} as ProductionSnapshot["headers"];

  // Home page
  const homeResponse = await fetch(baseUrl);
  headers.home = {
    url: baseUrl,
    status: homeResponse.status,
    statusText: homeResponse.statusText,
    headers: extractHeaders(homeResponse),
  };

  // Collections
  const collectionsResponse = await fetch(`${baseUrl}/collections`);
  headers.collections = {
    url: `${baseUrl}/collections`,
    status: collectionsResponse.status,
    statusText: collectionsResponse.statusText,
    headers: extractHeaders(collectionsResponse),
  };

  // Product
  const productUrl = `${baseUrl}/products/${productHandle}`;
  const productResponse = await fetch(productUrl);

  if (!productResponse.ok) {
    throw new Error(
      `Product ${productUrl} returned ${productResponse.status}. ` +
        `Cannot capture headers for non-existent product.`,
    );
  }

  headers.product = {
    url: productUrl,
    status: productResponse.status,
    statusText: productResponse.statusText,
    headers: extractHeaders(productResponse),
  };

  // Cart
  const cartResponse = await fetch(`${baseUrl}/cart`);
  headers.cart = {
    url: `${baseUrl}/cart`,
    status: cartResponse.status,
    statusText: cartResponse.statusText,
    headers: extractHeaders(cartResponse),
  };

  // Static asset (favicon)
  const faviconResponse = await fetch(`${baseUrl}/favicon.ico`);
  headers.staticAsset = {
    url: `${baseUrl}/favicon.ico`,
    status: faviconResponse.status,
    statusText: faviconResponse.statusText,
    headers: extractHeaders(faviconResponse),
  };

  return headers;
}

async function captureRedirects(
  baseUrl: string,
  variantId: string,
): Promise<{
  redirects: ProductionSnapshot["redirects"];
  unavailableCategories: Array<{ category: string; reason: string }>;
}> {
  const redirects: ProductionSnapshot["redirects"] = {
    discount: [],
    cartLines: [],
    checkout: [],
    admin: [],
    myshopify: [],
    localeRedirects: [],
  };

  const unavailableCategories: Array<{ category: string; reason: string }> = [];

  // Test discount code redirect
  try {
    const { response, chain } = await fetchWithRedirects(
      `${baseUrl}/discount/TESTCODE`,
    );
    if (chain.length > 1) {
      redirects.discount.push({
        from: chain[0],
        to: chain[chain.length - 1],
        status: response.status,
        chain,
      });
    }
  } catch (error) {
    throw new Error(`Failed to test discount redirect: ${error}`);
  }

  // Test discount query param (if it redirects)
  try {
    const { response, chain } = await fetchWithRedirects(
      `${baseUrl}/?discount=TESTCODE`,
    );
    if (chain.length > 1) {
      redirects.discount.push({
        from: chain[0],
        to: chain[chain.length - 1],
        status: response.status,
        chain,
      });
    }
  } catch (error) {
    throw new Error(`Failed to test discount query redirect: ${error}`);
  }

  // Test cart permalink with live variant
  try {
    const { response, chain } = await fetchWithRedirects(
      `${baseUrl}/cart/${variantId}:1`,
    );
    if (chain.length > 1) {
      redirects.cartLines.push({
        from: chain[0],
        to: chain[chain.length - 1],
        status: response.status,
        chain,
      });
    } else if (response.status === 200) {
      // Cart permalink may succeed without redirect (expected behavior)
      console.log(
        `   Cart permalink accepted without redirect (status ${response.status})`,
      );
    }
  } catch (error) {
    throw new Error(
      `Failed to test cart lines redirect with variant ${variantId}: ${error}`,
    );
  }

  // Test /admin redirect (should go to MyShopify)
  try {
    const { response, chain } = await fetchWithRedirects(`${baseUrl}/admin`);
    if (chain.length > 1) {
      redirects.admin.push({
        from: chain[0],
        to: chain[chain.length - 1],
        status: response.status,
        chain,
      });
    }
  } catch (error) {
    throw new Error(`Failed to test admin redirect: ${error}`);
  }

  // Checkout category: NOT safely testable
  unavailableCategories.push({
    category: "checkout",
    reason:
      "Checkout flows create draft orders; not safe to test without API cleanup",
  });

  // MyShopify category: Captured via /admin redirect above
  if (redirects.admin.length === 0) {
    unavailableCategories.push({
      category: "myshopify",
      reason: "/admin did not redirect to MyShopify domain",
    });
  } else {
    // Mark as covered by admin redirect
    console.log(
      `   MyShopify redirect captured via /admin → ${redirects.admin[0].to}`,
    );
  }

  // Test locale redirects (sample some locale prefixes)
  const locales = ["en-us", "en-ca", "fr-ca", "de-de", "es-es"];
  for (const locale of locales) {
    try {
      const { response, chain } = await fetchWithRedirects(
        `${baseUrl}/${locale}`,
      );
      if (chain.length > 1) {
        redirects.localeRedirects.push({
          from: chain[0],
          to: chain[chain.length - 1],
          status: response.status,
          chain,
        });
      }
    } catch (error) {
      console.warn(`Failed to test locale redirect for ${locale}:`, error);
    }
  }

  return { redirects, unavailableCategories };
}

async function captureLocaleInventory(
  baseUrl: string,
  sitemaps: Record<string, SitemapEntry[]>,
): Promise<ProductionSnapshot["locales"]> {
  const discovered: Set<string> = new Set();
  const paths: Set<string> = new Set();
  const sitemapAlternates: Record<string, string[]> = {};

  // Extract locale prefixes from sitemap URLs
  for (const [key, entries] of Object.entries(sitemaps)) {
    for (const entry of entries) {
      const url = new URL(entry.loc);
      const pathParts = url.pathname.split("/").filter(Boolean);

      // Check if first segment looks like a locale (e.g., en-us, en-ca)
      if (pathParts.length > 0 && /^[a-z]{2}-[a-z]{2}$/i.test(pathParts[0])) {
        const locale = pathParts[0].toLowerCase();
        discovered.add(locale);
        paths.add(url.pathname);

        if (!sitemapAlternates[entry.loc]) {
          sitemapAlternates[entry.loc] = [];
        }
      }
    }
  }

  return {
    discovered: Array.from(discovered).sort(),
    paths: Array.from(paths).sort(),
    sitemapAlternates,
  };
}

// ============================================================================
// Main Capture Function
// ============================================================================

async function captureSnapshot(baseUrl: string): Promise<ProductionSnapshot> {
  console.log(`\n📸 Capturing production snapshot from ${baseUrl}...\n`);

  // Discover live product contract
  const { handle: productHandle, variantId: productVariantId } =
    await discoverProductContract(baseUrl);

  // Capture robots.txt
  console.log("📄 Capturing robots.txt...");
  const robots = await captureRobots(baseUrl);

  // Capture sitemap index
  console.log("🗺️  Capturing sitemap index...");
  const sitemapIndex = await captureSitemapIndex(baseUrl);

  // Capture individual sitemaps
  console.log("🗺️  Capturing individual sitemaps...");
  const sitemapUrls = sitemapIndex.sitemaps.map((s) => s.loc);
  const sitemaps = await captureSitemaps(baseUrl, sitemapUrls);

  console.log(
    `   Found ${Object.keys(sitemaps).length} sitemaps with ${Object.values(sitemaps).reduce((sum, s) => sum + s.length, 0)} total entries`,
  );

  // Capture representative route metadata
  console.log("🏷️  Capturing route metadata...");
  const routes = await captureRouteMetadata(
    baseUrl,
    {
      ...REPRESENTATIVE_ROUTES,
      product: `/products/:handle`,
    },
    productHandle,
  );

  // Capture response headers
  console.log("📋 Capturing response headers...");
  const headers = await captureResponseHeaders(baseUrl, productHandle);

  // Capture redirects
  console.log("↪️  Capturing redirect inventory...");
  const { redirects, unavailableCategories } = await captureRedirects(
    baseUrl,
    productVariantId,
  );

  // Capture locale inventory
  console.log("🌍 Capturing locale inventory...");
  const locales = await captureLocaleInventory(baseUrl, sitemaps);

  console.log(
    `   Found ${locales.discovered.length} locale prefixes: ${locales.discovered.join(", ") || "none"}`,
  );

  const snapshot: ProductionSnapshot = {
    capturedAt: new Date().toISOString(),
    baseUrl,
    robots,
    sitemapIndex,
    sitemaps,
    routes,
    headers,
    redirects,
    locales,
    _testContract: {
      productHandle,
      productVariantId,
      unavailableCategories,
    },
  };

  console.log("\n✅ Snapshot capture complete!\n");

  return snapshot;
}

// ============================================================================
// Diff Function
// ============================================================================

interface SnapshotDiff {
  hasDifferences: boolean;
  sections: {
    robots?: string[];
    sitemaps?: string[];
    metadata?: string[];
    headers?: string[];
    redirects?: string[];
    locales?: string[];
  };
}

function diffSnapshots(
  baseline: ProductionSnapshot,
  current: ProductionSnapshot,
): SnapshotDiff {
  const diff: SnapshotDiff = {
    hasDifferences: false,
    sections: {},
  };

  // Diff robots.txt
  if (baseline.robots !== current.robots) {
    diff.hasDifferences = true;
    diff.sections.robots = [
      "robots.txt content differs",
      `  Baseline length: ${baseline.robots.length}`,
      `  Current length: ${current.robots.length}`,
    ];
  }

  // Diff sitemaps
  const baselineSitemapKeys = Object.keys(baseline.sitemaps).sort();
  const currentSitemapKeys = Object.keys(current.sitemaps).sort();

  if (
    JSON.stringify(baselineSitemapKeys) !== JSON.stringify(currentSitemapKeys)
  ) {
    diff.hasDifferences = true;
    diff.sections.sitemaps = diff.sections.sitemaps || [];
    diff.sections.sitemaps.push(
      "Sitemap list differs",
      `  Baseline: ${baselineSitemapKeys.join(", ")}`,
      `  Current: ${currentSitemapKeys.join(", ")}`,
    );
  }

  // Diff sitemap entry counts (ignore lastmod timestamps)
  for (const key of baselineSitemapKeys) {
    if (currentSitemapKeys.includes(key)) {
      const baselineCount = baseline.sitemaps[key].length;
      const currentCount = current.sitemaps[key].length;

      if (baselineCount !== currentCount) {
        diff.hasDifferences = true;
        diff.sections.sitemaps = diff.sections.sitemaps || [];
        diff.sections.sitemaps.push(
          `Sitemap ${key} entry count differs: ${baselineCount} → ${currentCount}`,
        );
      }

      // Sample a few entries to compare stable fields (excluding lastmod)
      const baselineNormalized = baseline.sitemaps[key]
        .slice(0, 3)
        .map(normalizeSitemapEntry);
      const currentNormalized = current.sitemaps[key]
        .slice(0, 3)
        .map(normalizeSitemapEntry);

      if (
        JSON.stringify(baselineNormalized) !== JSON.stringify(currentNormalized)
      ) {
        diff.hasDifferences = true;
        diff.sections.sitemaps = diff.sections.sitemaps || [];
        diff.sections.sitemaps.push(
          `Sitemap ${key} entry structure differs (sample of first 3 entries)`,
        );
      }
    }
  }

  // Diff metadata for representative routes
  for (const key of Object.keys(baseline.routes)) {
    const baselineRoute = baseline.routes[key as keyof typeof baseline.routes];
    const currentRoute = current.routes[key as keyof typeof current.routes];

    if (!currentRoute) {
      diff.hasDifferences = true;
      diff.sections.metadata = diff.sections.metadata || [];
      diff.sections.metadata.push(`Route ${key} missing in current snapshot`);
      continue;
    }

    if (baselineRoute.title !== currentRoute.title) {
      diff.hasDifferences = true;
      diff.sections.metadata = diff.sections.metadata || [];
      diff.sections.metadata.push(
        `Route ${key} title differs:`,
        `  Baseline: "${baselineRoute.title}"`,
        `  Current: "${currentRoute.title}"`,
      );
    }

    // Compare meta tag keys AND stable values
    const baselineMetaKeys = Object.keys(baselineRoute.meta).sort();
    const currentMetaKeys = Object.keys(currentRoute.meta).sort();

    if (JSON.stringify(baselineMetaKeys) !== JSON.stringify(currentMetaKeys)) {
      diff.hasDifferences = true;
      diff.sections.metadata = diff.sections.metadata || [];
      diff.sections.metadata.push(
        `Route ${key} meta tag keys differ:`,
        `  Baseline: ${baselineMetaKeys.join(", ")}`,
        `  Current: ${currentMetaKeys.join(", ")}`,
      );
    }

    // Compare stable meta values (exclude time-sensitive ones like image URLs with cache busters)
    for (const metaKey of baselineMetaKeys) {
      if (currentMetaKeys.includes(metaKey)) {
        const baselineValue = baselineRoute.meta[metaKey];
        const currentValue = currentRoute.meta[metaKey];

        // Only compare non-URL values or stable URL values
        if (
          baselineValue !== currentValue &&
          !metaKey.toLowerCase().includes("image") &&
          metaKey !== "twitter:image"
        ) {
          diff.hasDifferences = true;
          diff.sections.metadata = diff.sections.metadata || [];
          diff.sections.metadata.push(
            `Route ${key} meta[${metaKey}] value differs:`,
            `  Baseline: "${baselineValue}"`,
            `  Current: "${currentValue}"`,
          );
        }
      }
    }

    // Compare Open Graph and Twitter values similarly
    const baselineOgKeys = Object.keys(baselineRoute.og).sort();
    const currentOgKeys = Object.keys(currentRoute.og).sort();

    if (JSON.stringify(baselineOgKeys) !== JSON.stringify(currentOgKeys)) {
      diff.hasDifferences = true;
      diff.sections.metadata = diff.sections.metadata || [];
      diff.sections.metadata.push(
        `Route ${key} Open Graph keys differ:`,
        `  Baseline: ${baselineOgKeys.join(", ")}`,
        `  Current: ${currentOgKeys.join(", ")}`,
      );
    }
  }

  // Diff headers (with normalization)
  for (const key of Object.keys(baseline.headers)) {
    const baselineHeaders = normalizeHeaders(
      baseline.headers[key as keyof typeof baseline.headers].headers,
    );
    const currentHeaders = normalizeHeaders(
      current.headers[key as keyof typeof current.headers]?.headers || {},
    );

    if (JSON.stringify(baselineHeaders) !== JSON.stringify(currentHeaders)) {
      diff.hasDifferences = true;
      diff.sections.headers = diff.sections.headers || [];
      diff.sections.headers.push(
        `Route ${key} headers differ (CSP nonces normalized)`,
      );
    }
  }

  // Diff redirect categories
  for (const category of Object.keys(baseline.redirects)) {
    const baselineRedirects =
      baseline.redirects[category as keyof typeof baseline.redirects];
    const currentRedirects =
      current.redirects[category as keyof typeof current.redirects] || [];

    if (baselineRedirects.length !== currentRedirects.length) {
      diff.hasDifferences = true;
      diff.sections.redirects = diff.sections.redirects || [];
      diff.sections.redirects.push(
        `Redirect category "${category}" count differs: ${baselineRedirects.length} → ${currentRedirects.length}`,
      );
    }

    // Compare normalized redirect URLs
    for (
      let i = 0;
      i < Math.min(baselineRedirects.length, currentRedirects.length);
      i++
    ) {
      const baselineFrom = normalizeUrl(baselineRedirects[i].from);
      const currentFrom = normalizeUrl(currentRedirects[i].from);
      const baselineTo = normalizeUrl(baselineRedirects[i].to);
      const currentTo = normalizeUrl(currentRedirects[i].to);

      if (baselineFrom !== currentFrom || baselineTo !== currentTo) {
        diff.hasDifferences = true;
        diff.sections.redirects = diff.sections.redirects || [];
        diff.sections.redirects.push(
          `Redirect "${category}[${i}]" differs:`,
          `  Baseline: ${baselineFrom} → ${baselineTo}`,
          `  Current: ${currentFrom} → ${currentTo}`,
        );
      }
    }
  }

  // Diff locale inventory
  const baselineLocales = baseline.locales.discovered.join(",");
  const currentLocales = current.locales.discovered.join(",");

  if (baselineLocales !== currentLocales) {
    diff.hasDifferences = true;
    diff.sections.locales = [
      "Locale inventory differs:",
      `  Baseline: ${baseline.locales.discovered.join(", ") || "none"}`,
      `  Current: ${current.locales.discovered.join(", ") || "none"}`,
    ];
  }

  return diff;
}

function printDiff(diff: SnapshotDiff): void {
  if (!diff.hasDifferences) {
    console.log("\n✅ No differences found! Snapshots are identical.\n");
    return;
  }

  console.log("\n⚠️  Differences found:\n");

  for (const [section, messages] of Object.entries(diff.sections)) {
    console.log(`📍 ${section.toUpperCase()}:`);
    for (const message of messages || []) {
      console.log(`  ${message}`);
    }
    console.log("");
  }
}

// ============================================================================
// CLI
// ============================================================================

async function main() {
  const { values } = parseArgs({
    options: {
      url: {
        type: "string",
        short: "u",
      },
      diff: {
        type: "boolean",
        short: "d",
      },
      help: {
        type: "boolean",
        short: "h",
      },
    },
  });

  if (values.help) {
    console.log(`
Usage:
  pnpm capture-snapshot [options]

Options:
  --url, -u <url>    Base URL to capture (default: ${DEFAULT_BASE_URL})
  --diff, -d         Compare against baseline instead of capturing
  --help, -h         Show this help

Examples:
  pnpm capture-snapshot
  pnpm capture-snapshot --url https://staging.example.com
  pnpm capture-snapshot --diff --url http://localhost:5173
`);
    return;
  }

  const baseUrl = (values.url as string) || DEFAULT_BASE_URL;

  if (values.diff) {
    // Load baseline and compare
    console.log("\n🔍 Running snapshot diff...\n");

    const baselineData = await fs.readFile(SNAPSHOT_FILE, "utf-8");
    const baseline = JSON.parse(baselineData) as ProductionSnapshot;

    console.log(
      `Baseline: ${baseline.baseUrl} (captured ${baseline.capturedAt})`,
    );
    console.log(`Current:  ${baseUrl}\n`);

    const current = await captureSnapshot(baseUrl);
    const diff = diffSnapshots(baseline, current);

    printDiff(diff);

    process.exit(diff.hasDifferences ? 1 : 0);
  } else {
    // Capture new snapshot
    const snapshot = await captureSnapshot(baseUrl);

    // Ensure directory exists
    await fs.mkdir(SNAPSHOT_DIR, { recursive: true });

    // Write snapshot
    await fs.writeFile(
      SNAPSHOT_FILE,
      JSON.stringify(snapshot, null, 2),
      "utf-8",
    );

    console.log(`💾 Snapshot saved to ${SNAPSHOT_FILE}`);
    console.log(`\nTo compare against this baseline:`);
    console.log(`  pnpm diff-snapshot --url <your-url>\n`);
  }
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
