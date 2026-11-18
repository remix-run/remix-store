import { Accept } from "remix/headers";

// Browsers and wildcard clients get HTML; only clients that rank JSON above
// HTML get JSON.
export function prefersJson(request: Request): boolean {
  return (
    Accept.from(request.headers.get("Accept")).getPreferred([
      "text/html",
      "application/json",
    ]) === "application/json"
  );
}
