import type { ActionFunctionArgs } from "@remix-run/node";
import { redirect } from "@shopify/remix-oxygen";
import {
  serializeColorScheme,
  validateColorScheme,
} from "~/lib/color-scheme.server";
import { safeRedirect } from "~/lib/http.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const colorScheme = formData.get("colorScheme");
  if (!validateColorScheme(colorScheme)) {
    throw new Response("Bad Request", { status: 400 });
  }

  return safeRedirect(formData.get("returnTo"), {
    headers: { "Set-Cookie": await serializeColorScheme(colorScheme) },
  });
}
