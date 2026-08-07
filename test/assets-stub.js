import { registerHooks } from "node:module";

const source =
  'export default { entry: "/app/entry.browser.ts", js: [], css: [] };';
const url = `data:text/javascript,${encodeURIComponent(source)}`;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.includes("?assets=")) {
      return { url, format: "module", shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
