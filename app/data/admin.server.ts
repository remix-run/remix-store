import {
  any,
  array,
  nullable,
  object,
  optional,
  parseSafe,
  string,
  type Schema,
} from "remix/data-schema";

// Stable Shopify Admin version verified through publicApiVersions on 2026-08-13.
// `pnpm typecheck` validates every document below against its pinned schema.
export const ADMIN_API_VERSION = "2026-07";

export class AdminApiError extends Error {
  constructor(
    readonly code:
      | "configuration"
      | "transport"
      | "response"
      | "graphql"
      | "user",
  ) {
    super("Shopify Admin request failed");
    this.name = "AdminApiError";
  }
}

interface AdminClientOptions {
  accessToken: string | undefined;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  storeDomain: string | undefined;
}

interface CustomerRecord {
  id: string;
  marketingOptInLevel: string | null;
}

type JsonValue = boolean | number | string | null | JsonValue[] | JsonObject;

interface JsonObject {
  [key: string]: JsonValue;
}

const GraphqlEnvelopeSchema = object({
  // Passthrough retains operation fields for the operation-specific schema
  // supplied to request(); data-schema types an empty object shape as `{}`.
  data: optional(nullable(object({}, { unknownKeys: "passthrough" }))),
  errors: optional(array(any())),
});
const MarketingConsentSchema = nullable(
  object({ marketingOptInLevel: string() }),
).transform((consent) => consent?.marketingOptInLevel ?? null);
const CustomerByEmailSchema = object({
  customerByIdentifier: optional(
    nullable(
      object({
        id: string(),
        emailMarketingConsent: optional(MarketingConsentSchema),
      }),
    ),
  ),
});
const AdminNodeSchema = object({ id: string() });
const AdminUserErrorSchema = object({
  field: optional(nullable(array(string()))),
  message: string(),
});
const CustomerCreateSchema = object({
  customerCreate: object({
    customer: optional(nullable(AdminNodeSchema)),
    userErrors: array(AdminUserErrorSchema),
  }),
});
const TagsAddSchema = object({
  tagsAdd: object({
    node: optional(nullable(AdminNodeSchema)),
    userErrors: array(AdminUserErrorSchema),
  }),
});
const CustomerConsentUpdateSchema = object({
  customerEmailMarketingConsentUpdate: object({
    customer: optional(nullable(AdminNodeSchema)),
    userErrors: array(AdminUserErrorSchema),
  }),
});

/** Server-only, fetch-injected Shopify Admin GraphQL customer boundary. */
export function createAdminCustomerClient(options: AdminClientOptions) {
  let storeDomain = normalizeAdminDomain(options.storeDomain);
  if (!storeDomain || !options.accessToken) {
    throw new AdminApiError("configuration");
  }
  let requestFetch = options.fetch ?? globalThis.fetch;
  let endpoint = `https://${storeDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  async function request<Output>(
    query: string,
    variables: JsonObject,
    dataSchema: Schema<unknown, Output>,
  ): Promise<Output> {
    let response: Response;
    try {
      response = await requestFetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": options.accessToken!,
        },
        body: JSON.stringify({ query, variables }),
        signal: options.signal,
      });
    } catch (error) {
      if (options.signal?.aborted) throw options.signal.reason ?? error;
      throw new AdminApiError("transport");
    }
    if (!response.ok) throw new AdminApiError("response");

    let envelope = await parseGraphqlEnvelope(response);
    if (envelope.errors?.length) throw new AdminApiError("graphql");
    if (!envelope.data) throw new AdminApiError("response");
    return parseAdminResponse(dataSchema, envelope.data);
  }

  async function getCustomerByEmail(
    email: string,
  ): Promise<CustomerRecord | null> {
    let data = await request(
      CUSTOMER_BY_EMAIL,
      { email },
      CustomerByEmailSchema,
    );
    let customer = data.customerByIdentifier;
    if (!customer) return null;
    return {
      id: customer.id,
      marketingOptInLevel: customer.emailMarketingConsent ?? null,
    };
  }

  async function createCustomer(input: {
    consentUpdatedAt: string;
    email: string;
    tags: string[];
  }): Promise<void> {
    let data = await request(
      CUSTOMER_CREATE,
      {
        input: {
          email: input.email,
          tags: input.tags,
          emailMarketingConsent: consentInput(input.consentUpdatedAt),
        },
      },
      CustomerCreateSchema,
    );
    if (data.customerCreate.userErrors.length) {
      throw new AdminApiError("user");
    }
    if (!data.customerCreate.customer) throw new AdminApiError("response");
  }

  async function addTags(customerId: string, tags: string[]): Promise<void> {
    if (!tags.length) return;
    let data = await request(
      CUSTOMER_TAGS_ADD,
      { id: customerId, tags },
      TagsAddSchema,
    );
    if (data.tagsAdd.userErrors.length) throw new AdminApiError("user");
    if (!data.tagsAdd.node) throw new AdminApiError("response");
  }

  async function updateConsent(
    customerId: string,
    consentUpdatedAt: string,
  ): Promise<void> {
    let data = await request(
      CUSTOMER_CONSENT_UPDATE,
      {
        input: {
          customerId,
          emailMarketingConsent: consentInput(consentUpdatedAt),
        },
      },
      CustomerConsentUpdateSchema,
    );
    if (data.customerEmailMarketingConsentUpdate.userErrors.length) {
      throw new AdminApiError("user");
    }
    if (!data.customerEmailMarketingConsentUpdate.customer) {
      throw new AdminApiError("response");
    }
  }

  return { addTags, createCustomer, getCustomerByEmail, updateConsent };
}

export type AdminCustomerClient = ReturnType<typeof createAdminCustomerClient>;

export async function subscribeCustomer(
  client: AdminCustomerClient,
  input: { consentUpdatedAt: string; email: string; tags: string[] },
): Promise<void> {
  let customer = await client.getCustomerByEmail(input.email);
  if (!customer) {
    try {
      await client.createCustomer(input);
      return;
    } catch (error) {
      // A concurrent request can create the customer after our lookup. Retry
      // the lookup and continue through the idempotent existing-customer path.
      if (!(error instanceof AdminApiError) || error.code !== "user")
        throw error;
      customer = await client.getCustomerByEmail(input.email);
      if (!customer) throw error;
    }
  }

  await client.addTags(customer.id, [...new Set(input.tags)]);
  // Never replace Shopify's stronger confirmed opt-in record with single opt-in.
  if (customer.marketingOptInLevel !== "CONFIRMED_OPT_IN") {
    await client.updateConsent(customer.id, input.consentUpdatedAt);
  }
}

function consentInput(consentUpdatedAt: string) {
  return {
    consentUpdatedAt,
    marketingOptInLevel: "SINGLE_OPT_IN",
    marketingState: "SUBSCRIBED",
  };
}

function normalizeAdminDomain(value: string | undefined): string | null {
  if (!value) return null;
  try {
    let url = new URL(value.includes("://") ? value : `https://${value}`);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i.test(url.hostname)
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}

async function parseGraphqlEnvelope(response: Response) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await response.text());
  } catch {
    throw new AdminApiError("response");
  }
  return parseAdminResponse(GraphqlEnvelopeSchema, parsed);
}

function parseAdminResponse<Input, Output>(
  schema: Schema<Input, Output>,
  value: Input,
): Output {
  let result = parseSafe(schema, value);
  if (!result.success) throw new AdminApiError("response");
  return result.value;
}

const CUSTOMER_BY_EMAIL = `#graphql
  query RemixCustomerByEmail($email: String!) {
    customerByIdentifier(identifier: {emailAddress: $email}) {
      id
      emailMarketingConsent {
        marketingOptInLevel
      }
    }
  }
`;

const CUSTOMER_CREATE = `#graphql
  mutation RemixCustomerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;

const CUSTOMER_TAGS_ADD = `#graphql
  mutation RemixCustomerTagsAdd($id: ID!, $tags: [String!]!) {
    tagsAdd(id: $id, tags: $tags) {
      node { id }
      userErrors { field message }
    }
  }
`;

const CUSTOMER_CONSENT_UPDATE = `#graphql
  mutation RemixCustomerConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer { id }
      userErrors { field message }
    }
  }
`;
