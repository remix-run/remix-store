// PRE-LAUNCH CHECK -- this whole route is a pre-launch check
import { isRouteErrorResponse, useRouteError } from "@remix-run/react";
import { redirect, type LoaderFunctionArgs } from "@remix-run/server-runtime";
import splashSrc from "~/assets/images/splash.avif";

export function meta() {
  return [
    { title: "Remix" },
    { description: "Soft wear for engineers of all kinds" },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ request }: LoaderFunctionArgs) {
  // if not on / redirect to /
  const url = new URL(request.url);
  if (url.pathname !== "/") {
    return redirect("/");
  }
  return null;
}

export default function Splash() {
  return (
    <main className="flex h-screen w-full flex-col items-center justify-center bg-[#0A101A]">
      <img
        src={splashSrc}
        alt=""
        width={1107}
        height={865}
        className="w-full max-w-[550px] object-cover"
      />
      <h1 className="font-mono text-base text-white uppercase">
        Available May 19th
      </h1>
    </main>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="flex h-screen w-full flex-col items-center justify-center bg-[#0A101A]">
      <h1 className="font-mono text-base text-white uppercase">{message}</h1>
      <p className="font-mono text-sm text-white uppercase">{details}</p>
    </main>
  );
}
