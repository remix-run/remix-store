import { initializeShopifyScripts } from "@shopify/hydrogen";
import { navigate as remixNavigate, run, type FrameContent } from "remix/ui";

import { configureOpenCartAction } from "./assets/public/cart.tsx";
import { routeTemplates } from "./lib/public/route-templates.ts";

let moduleLoads = new Map<string, Promise<Record<string, unknown>>>();

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await loadBrowserModule(moduleUrl);
    let component = module[exportName];
    if (typeof component !== "function") {
      throw new Error(
        `Client entry export "${exportName}" from "${moduleUrl}" is not a function.`,
      );
    }
    return component;
  },
  async resolveFrame(src, signal, target) {
    return resolveFrameResponse(
      new URL(src, window.location.href),
      signal,
      target,
    );
  },
});

async function resolveFrameResponse(
  url: URL,
  signal?: AbortSignal,
  target?: string,
): Promise<FrameContent> {
  let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
  if (target) headers.set("X-Remix-Target", target);

  let response = await fetch(url, {
    credentials: "same-origin",
    headers,
    signal,
  });
  let contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(
      `Failed to resolve HTML frame: ${response.status} ${response.statusText}`,
    );
  }

  // Buffer the document and load its client-entry modules before handing it to
  // the frame runtime. Otherwise a streamed navigation can remove the previous
  // page's client-entry regions before a cold destination module is ready,
  // briefly leaving only the footer in the viewport.
  let html = await response.text();
  await waitForDestinationModules(html, signal);

  // Error statuses still contain the branded document that navigation should
  // render (for example, when traversing history back to a 404).
  return html;
}

function loadBrowserModule(
  moduleUrl: string,
): Promise<Record<string, unknown>> {
  let existing = moduleLoads.get(moduleUrl);
  if (existing) return existing;

  let pending = import(/* @vite-ignore */ moduleUrl) as Promise<
    Record<string, unknown>
  >;
  moduleLoads.set(moduleUrl, pending);
  pending.catch(() => moduleLoads.delete(moduleUrl));
  return pending;
}

async function waitForDestinationModules(
  html: string,
  signal?: AbortSignal,
): Promise<void> {
  if (signal?.aborted) throw signal.reason;

  let preload = preloadFrameModules(html).catch((error) => {
    console.error("Unable to preload destination modules:", error);
  });
  if (!signal) return preload;

  let rejectOnAbort!: (reason?: unknown) => void;
  let abort = new Promise<never>((_resolve, reject) => {
    rejectOnAbort = () => reject(signal.reason);
    signal.addEventListener("abort", rejectOnAbort, { once: true });
  });
  try {
    await Promise.race([preload, abort]);
  } finally {
    signal.removeEventListener("abort", rejectOnAbort);
  }
}

async function preloadFrameModules(html: string): Promise<void> {
  let document = new DOMParser().parseFromString(html, "text/html");
  let dataElement = document.getElementById("rmx-data");
  if (!dataElement?.textContent) return;

  let data: unknown;
  try {
    data = JSON.parse(dataElement.textContent);
  } catch {
    return;
  }
  if (!isRecord(data) || !isRecord(data.h)) return;

  let moduleUrls = new Set<string>();
  for (let hydration of Object.values(data.h)) {
    if (!isRecord(hydration) || typeof hydration.moduleUrl !== "string") {
      continue;
    }
    let url = new URL(hydration.moduleUrl, window.location.href);
    if (url.origin === window.location.origin) moduleUrls.add(url.href);
  }
  await Promise.all([...moduleUrls].map(loadBrowserModule));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error(
        "Error reloading the top frame after a server update:",
        error,
      );
    }
  });
}

app.addEventListener("error", (event) => {
  console.error("Hydration error:", event.error);
});

await Promise.all([
  app.ready(),
  initializeShopifyScripts({
    routes: routeTemplates,
    navigate(url) {
      remixNavigate(url);
    },
  }),
]);

configureOpenCartAction();
