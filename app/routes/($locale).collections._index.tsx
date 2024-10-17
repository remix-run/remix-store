import { redirect } from "@shopify/remix-oxygen";

export async function loader() {
  // TODO: Add a collections index page, for now just redirect to all products
  throw redirect("/collections/all");
}
