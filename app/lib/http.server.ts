import { redirect } from "@shopify/remix-oxygen";

export function safeRedirect(
  to: FormDataEntryValue | string | null | undefined,
  init?: number | ResponseInit,
) {
  if (
    !to ||
    typeof to !== "string" ||
    !to.startsWith("/") ||
    to.startsWith("//")
  ) {
    to = "/";
  }
  return redirect(to, init);
}
