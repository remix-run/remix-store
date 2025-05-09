import { type LoaderFunctionArgs } from "@shopify/remix-oxygen";
import { type MetaArgs, useLoaderData } from "react-router";
import { PageTitle } from "~/components/page-title";
import type { RootLoader } from "~/root";
import { generateMeta } from "~/lib/meta";
import { getPolicyData } from "~/lib/data/policy.server";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  const { siteUrl } = matches[0].data;

  return generateMeta({
    title: data?.policy.title,
    url: siteUrl,
  });
}

export async function loader({ params, context }: LoaderFunctionArgs) {
  if (!params.handle) {
    throw new Response("No handle was passed in", { status: 404 });
  }

  const policy = await getPolicyData(context.storefront, {
    handle: params.handle,
  });

  return { policy };
}

export default function Policies() {
  const { policy } = useLoaderData<typeof loader>();

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
