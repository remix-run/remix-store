import { relative, resolve } from "node:path";

import MagicString from "magic-string";
import { normalizePath, parseSync, type Plugin } from "vite";

export function clientEntries(
  register: (key: string, exports: string[]) => void,
): Plugin {
  let root: string;
  return {
    name: "remix:client-entries",
    enforce: "pre",
    sharedDuringBuild: true,
    configResolved(config) {
      root = config.root;
    },
    transform(code, id) {
      if (!code.includes("clientEntry") || !code.includes("import.meta.url"))
        return;
      let parsed = parseSync(id, code);
      if (parsed.errors.length)
        throw new Error(
          `Cannot parse client entry module '${id}': ${parsed.errors[0]?.message}`,
        );
      let callees = new Set<string>();
      for (let node of parsed.program.body) {
        if (
          node.type !== "ImportDeclaration" ||
          node.source.value !== "remix/component"
        )
          continue;
        for (let specifier of node.specifiers) {
          if (
            specifier.type === "ImportSpecifier" &&
            specifier.imported.type === "Identifier" &&
            specifier.imported.name === "clientEntry"
          ) {
            callees.add(specifier.local.name);
          }
        }
      }
      let output = new MagicString(code);
      let names: string[] = [];
      let key = normalizePath(relative(root, id));
      for (let node of parsed.program.body) {
        if (
          node.type !== "ExportNamedDeclaration" ||
          node.declaration?.type !== "VariableDeclaration"
        )
          continue;
        for (let declaration of node.declaration.declarations) {
          let call = declaration.init;
          if (
            declaration.id.type !== "Identifier" ||
            call?.type !== "CallExpression" ||
            call.callee.type !== "Identifier" ||
            !callees.has(call.callee.name) ||
            call.arguments.length < 2
          )
            continue;
          let argument = call.arguments[0];
          if (
            argument?.type !== "MemberExpression" ||
            argument.computed ||
            argument.object.type !== "MetaProperty" ||
            argument.object.meta.name !== "import" ||
            argument.object.property.name !== "meta" ||
            argument.property.type !== "Identifier" ||
            argument.property.name !== "url"
          )
            continue;
          if (key.startsWith("../") || resolve(root, key) !== id)
            throw new Error(
              `Client entry '${id}' must be inside the Vite root.`,
            );
          names.push(declaration.id.name);
          output.overwrite(
            argument.start,
            argument.end,
            JSON.stringify(`file:${key}#${declaration.id.name}`),
          );
        }
      }
      if (!names.length) return;
      if (this.environment.config.consumer === "server") register(key, names);
      return {
        code: output.toString(),
        map: output.generateMap({ hires: "boundary", source: id }),
      };
    },
  };
}
