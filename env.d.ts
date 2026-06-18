/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import "@total-typescript/ts-reset";

import type { HydrogenSessionData, HydrogenEnv } from "@shopify/hydrogen";

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
  interface SessionData extends HydrogenSessionData {
    // declare local additions to the React Router session data here
  }
}
