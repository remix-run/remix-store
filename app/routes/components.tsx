import { Link, Outlet, useLoaderData } from "@remix-run/react";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib";

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const selectedComponent = data?.selectedComponent;
  const title = selectedComponent
    ? `${selectedComponent} | Component Library`
    : "Component Library";
  return [
    {
      title: title.charAt(0).toUpperCase() + title.slice(1),
    },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
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
    <div>
      <nav className="flex items-center justify-between">
        <h1 className="font-sans text-8xl capitalize">{selectedComponent}</h1>
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
