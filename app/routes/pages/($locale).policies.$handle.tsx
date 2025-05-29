import { PageTitle } from "~/components/page-title";
import { generateMeta } from "~/lib/meta";
import { getPolicyData } from "~/lib/data/policy.server";
import type { Route } from "./+types/($locale).policies.$handle";

export function meta({ data, matches }: Route.MetaArgs) {
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: data?.policy.title,
    url: siteUrl,
  });
}

export async function loader({ params, context }: Route.LoaderArgs) {
  if (!params.handle) {
    throw new Response("No handle was passed in", { status: 404 });
  }

  const policy = await getPolicyData(context.storefront, {
    handle: params.handle,
  });

  return { policy };
}

export default function Policies({ loaderData }: Route.ComponentProps) {
  const { policy } = loaderData;

  return (
    <main>
      <PageTitle>{policy.title}</PageTitle>
      <div className="policy-container mx-auto max-w-[700px]">
        <div className="" dangerouslySetInnerHTML={{ __html: policy.body }} />
      </div>

      <div
        // bottom spacer
        className="h-36"
      />
    </main>
  );
}
