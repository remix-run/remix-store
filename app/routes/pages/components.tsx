import { Link, Outlet } from "react-router";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib/cn";
import { generateMeta } from "~/lib/meta";
import type { Route } from "./+types/components";

export function meta({ data, matches }: Route.MetaArgs) {
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

export async function loader({ request }: Route.LoaderArgs) {
  // TODO: turn this on only for the most prodest of environments
  if (process.env.NODE_ENV === "production") {
    throw new Response("Not found", { status: 404 });
  }

  const componentFiles = import.meta.glob("../pages/components.*.tsx", {
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

export default function Components({ loaderData }: Route.ComponentProps) {
  const { componentRoutes, selectedComponent } = loaderData;

  return (
    <div className="mt-32">
      <nav className="flex items-center justify-between px-9">
        <h1 className="mb-8 font-sans text-6xl font-bold text-white capitalize">
          {selectedComponent || "Component Library"}
        </h1>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="rounded-xl border border-white bg-white/10 px-4 py-2 text-2xl font-medium text-white lowercase shadow-sm transition hover:bg-white/20 focus:ring-2 focus:ring-blue-400 focus:outline-none">
                {selectedComponent ? selectedComponent : "select a component"}
              </button>
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
