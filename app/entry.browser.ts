import type { FrameContent } from "remix/ui";
import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(/* @vite-ignore */ moduleUrl);
    return module[exportName];
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

  // Error statuses still contain the branded document that navigation should
  // render (for example, when traversing history back to a 404).
  return response.body ?? response.text();
}

app.addEventListener("error", (event) => {
  console.error("Hydration error:", event.error);
});

await app.ready();
