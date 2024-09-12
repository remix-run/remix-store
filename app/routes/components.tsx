import { Link, Outlet, useLoaderData, useLocation } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuContent,
} from "~/components/ui/dropdown-menu";
import { cn } from "~/lib";

export async function loader() {
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

  // Return the paths as loader data
  return { componentRoutes: paths };
}

export default function Components() {
  const { componentRoutes } = useLoaderData<typeof loader>();
  const { pathname } = useLocation();

  const selectedComponent = pathname.split("/").at(-1);

  return (
    <div>
      <nav className="flex items-center justify-between">
        <h1 className="font-sans text-8xl capitalize">{selectedComponent}</h1>
        <div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="px-4 lowercase">
                select a component
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
    <section className="mt-8 px-8 py-6">
      <h2 className="text-4xl">{title}</h2>
      <div className={cn("mt-6", className)}>{children}</div>
    </section>
  );
}
