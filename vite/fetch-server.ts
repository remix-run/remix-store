import { createRequestListener } from "remix/node-fetch-server";
import { isRunnableDevEnvironment, type Plugin } from "vite";

/** Used only when MiniOxygen is not supplying the development HTTP boundary. */
export function fetchServer(entry: string): Plugin {
  return {
    name: "remix:fetch-server",
    apply: "serve",
    configureServer(server) {
      return () => {
        let environment = server.environments.ssr;
        if (!environment || !isRunnableDevEnvironment(environment)) {
          throw new Error(
            "The Fetch dev bridge requires a runnable ssr environment. Disable it when MiniOxygen owns requests.",
          );
        }
        let listener = createRequestListener(async (request) => {
          let module = await environment.runner.import(entry);
          if (typeof module.default?.fetch !== "function")
            throw new Error(`'${entry}' must export default { fetch }.`);
          return module.default.fetch(request);
        });
        server.middlewares.use((request, response, next) => {
          Promise.resolve(listener(request, response)).catch(next);
        });
      };
    },
  };
}
