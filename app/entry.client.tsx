import { RemixBrowser } from "@remix-run/react";
import { Aside } from "~/components/Aside";
import { startTransition, StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <Aside.Provider>
        <RemixBrowser />
      </Aside.Provider>
    </StrictMode>,
  );
});
