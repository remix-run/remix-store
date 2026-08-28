import { readFile } from "node:fs/promises";

import { buildClientSchema, parse, validate } from "graphql";

const VERSION = "2026-07";
const EXPECTED_OPERATIONS = new Set([
  "RemixCustomerByEmail",
  "RemixCustomerConsentUpdate",
  "RemixCustomerCreate",
  "RemixCustomerTagsAdd",
]);

const [schemaJson, source] = await Promise.all([
  readFile(new URL(`../admin-${VERSION}.schema.json`, import.meta.url), "utf8"),
  readFile(new URL("../app/data/admin.server.ts", import.meta.url), "utf8"),
]);
const introspection = JSON.parse(schemaJson);
const schema = buildClientSchema(introspection.data);
const documents = [...source.matchAll(/= `#graphql\n([\s\S]*?)\n`;/g)].map(
  (match) => parse(match[1]),
);
const operationNames = new Set(
  documents.flatMap((document) =>
    document.definitions.flatMap((definition) =>
      definition.kind === "OperationDefinition" && definition.name
        ? [definition.name.value]
        : [],
    ),
  ),
);

if (
  operationNames.size !== EXPECTED_OPERATIONS.size ||
  [...EXPECTED_OPERATIONS].some((name) => !operationNames.has(name))
) {
  throw new Error(
    `Admin operation set changed without contract validation: ${[
      ...operationNames,
    ].join(", ")}`,
  );
}

const errors = documents.flatMap((document) => validate(schema, document));
if (errors.length) {
  throw new Error(
    `Admin ${VERSION} GraphQL validation failed:\n${errors
      .map((error) => `- ${error.message}`)
      .join("\n")}`,
  );
}
