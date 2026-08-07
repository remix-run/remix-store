import { run } from "remix/ui";

let app = run({
  async loadModule(moduleUrl, exportName) {
    let module = await import(/* @vite-ignore */ moduleUrl);
    return module[exportName];
  },
});

app.addEventListener("error", (event) => {
  console.error("Hydration error:", event.error);
});

await app.ready();
