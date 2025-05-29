import { href, redirect } from "react-router";

export async function loader() {
  // TODO: Add a collections index page, for now just redirect to all products
  throw redirect(href("/collections/:handle", { handle: "all" }));
}
