import type { EntryContext, AppLoadContext } from "@shopify/remix-oxygen";
import { RemixServer } from "@remix-run/react";
import isbot from "isbot";
import { renderToReadableStream } from "react-dom/server";
import { createContentSecurityPolicy } from "@shopify/hydrogen";
import { Aside } from "~/components/Aside";

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: EntryContext,
  context: AppLoadContext,
) {
  const { nonce, header, NonceProvider } = createContentSecurityPolicy({
    fontSrc: [
      "'self'",
      "https://fonts.googleapis.com",
      "https://fonts.gstatic.com/",
    ],
    styleSrc: ["'self'", "https://fonts.googleapis.com"],
    shop: {
      checkoutDomain: context.env.PUBLIC_CHECKOUT_DOMAIN,
      storeDomain: context.env.PUBLIC_STORE_DOMAIN,
    },
  });

  const body = await renderToReadableStream(
    <NonceProvider>
      <Aside.Provider>
        <RemixServer context={remixContext} url={request.url} />
      </Aside.Provider>
    </NonceProvider>,
    {
      nonce,
      signal: request.signal,
      onError(error) {
        console.error(error);
        responseStatusCode = 500;
      },
    },
  );

  if (isbot(request.headers.get("user-agent"))) {
    await body.allReady;
  }

  responseHeaders.set("Content-Type", "text/html");
  responseHeaders.set("Content-Security-Policy", header);

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
