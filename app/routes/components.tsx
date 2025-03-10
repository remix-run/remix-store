import { Link, Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs, MetaArgs } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/cn";
import { generateMeta } from "~/lib/meta";
import type { RootLoader } from "~/root";

export function meta({
  data,
  matches,
}: MetaArgs<typeof loader, { root: RootLoader }>) {
  const selectedComponent = data?.selectedComponent;
  const title = selectedComponent
    ? `${selectedComponent} | Component Library`
    : "Component Library";

  // Try to get siteUrl from root data if available
  const siteUrl = matches[0]?.data?.siteUrl;

  return generateMeta({
    title: title.charAt(0).toUpperCase() + title.slice(1),
    description: "Component library for the Remix Store",
    url: siteUrl,
  });
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  // TODO: turn this on only for the most prodest of environments
  // if (process.env.NODE_ENV === "production") {
  //   throw new Response("Not found", { status: 404 });
  // }

  const componentFiles = import.meta.glob("../routes/components.*.tsx", {
    eager: true,
  });

  const paths = Object.keys(componentFiles).map((path) => {
    const routePath = path.replace(/.*components\.(.*)\.tsx$/, "$1");
    return routePath;
  });

  const url = new URL(request.url);
  const selectedComponent = url.pathname.split("/").at(-1);

  // Return the paths and selectedComponent as loader data
  return { componentRoutes: paths, selectedComponent };
}

export default function Components() {
  const { componentRoutes, selectedComponent } = useLoaderData<typeof loader>();

  return (
    <div className="mt-32">
      <nav className="flex items-center justify-between px-9">
        <h1 className="mb-8 font-sans text-6xl font-bold text-white capitalize">
          {selectedComponent || "Component Library"}
        </h1>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="px-4 lowercase">
                {selectedComponent ? selectedComponent : "select a component"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {componentRoutes.map((route) => (
                <DropdownMenuItem
                  className="text-2xl capitalize no-underline"
                  asChild
                  key={route}
                >
                  <Link to={route}>{route}</Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>
      <div className="min-h-96">
        <Outlet />
      </div>
    </div>
  );
}

export const shouldRevalidate = () => true;

export function Section({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 px-9 py-6">
      <h2 className="text-4xl">{title}</h2>
      <div className={cn("mt-6", className)}>{children}</div>
    </section>
  );
}
