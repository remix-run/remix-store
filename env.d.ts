/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />

// Enhance TypeScript's built-in typings.
import "@total-typescript/ts-reset";

import type {
  HydrogenContext,
  HydrogenSessionData,
  HydrogenEnv,
} from "@shopify/hydrogen";
import type { createAppLoadContext } from "~/lib/context";

declare global {
  /**
   * A global `process` object is only available during build to access NODE_ENV.
   */
  const process: { env: { NODE_ENV: "production" | "development" } };

  interface Env extends HydrogenEnv {
    // declare additional Env parameter use in the fetch handler and Remix loader context here
    ADMIN_ACCESS_TOKEN?: string;
  }
}

declare module "react-router" {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  interface unstable_RouterContextProvider
    extends Awaited<ReturnType<typeof createAppLoadContext>> {
    // to change context type, change the return of createAppLoadContext() instead
  }

  interface SessionData extends HydrogenSessionData {
    // declare local additions to the Remix session data here
  }
}
