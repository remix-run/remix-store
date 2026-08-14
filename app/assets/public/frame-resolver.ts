import type { ResolveFrameOptions } from "remix/ui";

export async function resolveFrameResponse(
  url: URL,
  options?: ResolveFrameOptions,
): Promise<Response> {
  let headers = new Headers({ Accept: "text/html", "X-Remix-Frame": "true" });
  if (options?.target) headers.set("X-Remix-Target", options.target);

  let method = options?.method?.toUpperCase() ?? "GET";
  let body = submissionBody(options?.formData, options?.encType, headers);
  let response = await fetch(url, {
    body,
    credentials: "same-origin",
    headers,
    method,
    signal: options?.signal,
  });
  let contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.toLowerCase().includes("text/html")) {
    throw new Error(
      `Failed to resolve HTML frame: ${response.status} ${response.statusText}`,
    );
  }

  // Keep the Response so Remix can use the final URL after a redirect while
  // still rendering branded error documents from non-success responses.
  return response;
}

function submissionBody(
  formData: FormData | undefined,
  encType: string | undefined,
  headers: Headers,
): BodyInit | undefined {
  if (!formData) return undefined;

  if (encType?.toLowerCase() === "multipart/form-data") return formData;

  if (encType?.toLowerCase() === "text/plain") {
    headers.set("Content-Type", "text/plain;charset=UTF-8");
    return Array.from(
      formData,
      ([name, value]) =>
        `${name}=${typeof value === "string" ? value : value.name}\r\n`,
    ).join("");
  }

  let searchParams = new URLSearchParams();
  for (let [name, value] of formData) {
    searchParams.append(name, typeof value === "string" ? value : value.name);
  }
  return searchParams;
}
