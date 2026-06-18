import type { Route } from "./+types/($locale).$";

export async function loader({ url }: Route.LoaderArgs) {
  throw new Response(`${url.pathname} not found`, {
    status: 404,
  });
}

export default function CatchAllPage() {
  return null;
}
