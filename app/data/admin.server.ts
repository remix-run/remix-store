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

interface GraphqlEnvelope {
  data?: Record<string, unknown> | null;
  errors?: unknown[];
}

/** Server-only, fetch-injected Shopify Admin GraphQL customer boundary. */
export function createAdminCustomerClient(options: AdminClientOptions) {
  let storeDomain = normalizeAdminDomain(options.storeDomain);
  if (!storeDomain || !options.accessToken) {
    throw new AdminApiError("configuration");
  }
  let requestFetch = options.fetch ?? globalThis.fetch;
  let endpoint = `https://${storeDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;

  async function request(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
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

    let envelope: GraphqlEnvelope;
    try {
      envelope = (await response.json()) as GraphqlEnvelope;
    } catch {
      throw new AdminApiError("response");
    }
    if (envelope.errors?.length) throw new AdminApiError("graphql");
    if (!envelope.data || typeof envelope.data !== "object") {
      throw new AdminApiError("response");
    }
    return envelope.data;
  }

  async function getCustomerByEmail(
    email: string,
  ): Promise<CustomerRecord | null> {
    let data = await request(CUSTOMER_BY_EMAIL, { email });
    let customer = data.customerByIdentifier;
    if (customer === null || customer === undefined) return null;
    if (!isRecord(customer) || typeof customer.id !== "string") {
      throw new AdminApiError("response");
    }
    let consent = customer.emailMarketingConsent;
    return {
      id: customer.id,
      marketingOptInLevel:
        isRecord(consent) && typeof consent.marketingOptInLevel === "string"
          ? consent.marketingOptInLevel
          : null,
    };
  }

  async function createCustomer(input: {
    consentUpdatedAt: string;
    email: string;
    tags: string[];
  }): Promise<void> {
    let data = await request(CUSTOMER_CREATE, {
      input: {
        email: input.email,
        tags: input.tags,
        emailMarketingConsent: consentInput(input.consentUpdatedAt),
      },
    });
    assertMutation(data.customerCreate, "customer");
  }

  async function addTags(customerId: string, tags: string[]): Promise<void> {
    if (!tags.length) return;
    let data = await request(CUSTOMER_TAGS_ADD, { id: customerId, tags });
    assertMutation(data.tagsAdd, "node");
  }

  async function updateConsent(
    customerId: string,
    consentUpdatedAt: string,
  ): Promise<void> {
    let data = await request(CUSTOMER_CONSENT_UPDATE, {
      input: {
        customerId,
        emailMarketingConsent: consentInput(consentUpdatedAt),
      },
    });
    assertMutation(data.customerEmailMarketingConsentUpdate, "customer");
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

function assertMutation(value: unknown, resultField: string): void {
  if (!isRecord(value)) throw new AdminApiError("response");
  let errors = value.userErrors;
  if (!Array.isArray(errors)) throw new AdminApiError("response");
  if (errors.length) throw new AdminApiError("user");
  if (!value[resultField]) throw new AdminApiError("response");
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
