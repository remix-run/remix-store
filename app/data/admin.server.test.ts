import * as assert from "remix/assert";
import * as s from "remix/data-schema";
import { describe, it } from "remix/test";

import {
  ADMIN_API_VERSION,
  AdminApiError,
  createAdminCustomerClient,
  subscribeCustomer,
} from "./admin.server.ts";

describe("Shopify Admin customer client", () => {
  it("creates a customer with single-opt-in consent through an injected fetch", async () => {
    let requests: Array<{ body: AdminBody; headers: Headers; url: string }> =
      [];
    let client = createAdminCustomerClient({
      accessToken: "server-secret",
      storeDomain: "example.myshopify.com",
      fetch: async (input, init) => {
        let body = parseAdminBody(init?.body);
        requests.push({
          body,
          headers: new Headers(init?.headers),
          url: String(input),
        });
        if (body.query.includes("RemixCustomerByEmail")) {
          return response({ customerByIdentifier: null });
        }
        return response({
          customerCreate: { customer: { id: "customer-1" }, userErrors: [] },
        });
      },
    });

    await subscribeCustomer(client, {
      consentUpdatedAt: "2026-07-30T12:00:00.000Z",
      email: "member@example.com",
      tags: [],
    });

    assert.equal(requests.length, 2);
    assert.equal(
      requests[0]?.url,
      `https://example.myshopify.com/admin/api/${ADMIN_API_VERSION}/graphql.json`,
    );
    assert.equal(
      requests[0]?.headers.get("X-Shopify-Access-Token"),
      "server-secret",
    );
    assert.deepEqual(requests[1]?.body.variables, {
      input: {
        email: "member@example.com",
        tags: [],
        emailMarketingConsent: {
          consentUpdatedAt: "2026-07-30T12:00:00.000Z",
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "SUBSCRIBED",
        },
      },
    });
  });

  it("adds only new tags and preserves confirmed opt-in for existing customers", async () => {
    let operations: string[] = [];
    let client = createAdminCustomerClient({
      accessToken: "server-secret",
      storeDomain: "example.myshopify.com",
      fetch: async (_input, init) => {
        let body = parseAdminBody(init?.body);
        operations.push(body.query);
        if (body.query.includes("RemixCustomerByEmail")) {
          return response({
            customerByIdentifier: {
              id: "customer-1",
              emailMarketingConsent: {
                marketingOptInLevel: "CONFIRMED_OPT_IN",
              },
            },
          });
        }
        if (body.query.includes("RemixCustomerTagsAdd")) {
          assert.deepEqual(body.variables, {
            id: "customer-1",
            tags: ["back-in-stock-subscriber", "specific-tag"],
          });
          return response({
            tagsAdd: { node: { id: "customer-1" }, userErrors: [] },
          });
        }
        throw new Error("Consent must not be downgraded");
      },
    });

    await subscribeCustomer(client, {
      consentUpdatedAt: "2026-07-30T12:00:00.000Z",
      email: "member@example.com",
      tags: ["back-in-stock-subscriber", "specific-tag", "specific-tag"],
    });
    assert.equal(operations.length, 2);
  });

  it("rejects malformed consent instead of risking an opt-in downgrade", async () => {
    let client = createAdminCustomerClient({
      accessToken: "server-secret",
      storeDomain: "example.myshopify.com",
      fetch: async () =>
        response({
          customerByIdentifier: {
            id: "customer-1",
            emailMarketingConsent: { marketingOptInLevel: 123 },
          },
        }),
    });

    let error = await rejectedAdminError(
      subscribeCustomer(client, {
        consentUpdatedAt: "2026-08-13T12:00:00.000Z",
        email: "member@example.com",
        tags: [],
      }),
    );

    assert.equal(error.code, "response");
  });

  it("sends the validated tag and consent operation shapes for existing customers", async () => {
    let requests: AdminBody[] = [];
    let client = createAdminCustomerClient({
      accessToken: "server-secret",
      storeDomain: "example.myshopify.com",
      fetch: async (_input, init) => {
        let body = parseAdminBody(init?.body);
        requests.push(body);
        if (body.query.includes("RemixCustomerByEmail")) {
          return response({
            customerByIdentifier: {
              id: "customer-1",
              emailMarketingConsent: { marketingOptInLevel: "SINGLE_OPT_IN" },
            },
          });
        }
        if (body.query.includes("RemixCustomerTagsAdd")) {
          return response({
            tagsAdd: { node: { id: "customer-1" }, userErrors: [] },
          });
        }
        if (body.query.includes("RemixCustomerConsentUpdate")) {
          return response({
            customerEmailMarketingConsentUpdate: {
              customer: { id: "customer-1" },
              userErrors: [],
            },
          });
        }
        throw new Error("Unexpected Admin operation");
      },
    });

    await subscribeCustomer(client, {
      consentUpdatedAt: "2026-08-13T12:00:00.000Z",
      email: "member@example.com",
      tags: ["back-in-stock-subscriber"],
    });

    assert.match(
      requests[1]?.query ?? "",
      /mutation RemixCustomerTagsAdd\(\$id: ID!, \$tags: \[String!\]!\)/,
    );
    assert.match(requests[1]?.query ?? "", /tagsAdd\(id: \$id, tags: \$tags\)/);
    assert.deepEqual(requests[1]?.variables, {
      id: "customer-1",
      tags: ["back-in-stock-subscriber"],
    });
    assert.match(
      requests[2]?.query ?? "",
      /mutation RemixCustomerConsentUpdate\(\$input: CustomerEmailMarketingConsentUpdateInput!\)/,
    );
    assert.match(
      requests[2]?.query ?? "",
      /customerEmailMarketingConsentUpdate\(input: \$input\)/,
    );
    assert.deepEqual(requests[2]?.variables, {
      input: {
        customerId: "customer-1",
        emailMarketingConsent: {
          consentUpdatedAt: "2026-08-13T12:00:00.000Z",
          marketingOptInLevel: "SINGLE_OPT_IN",
          marketingState: "SUBSCRIBED",
        },
      },
    });
  });

  it("refuses to send credentials to a non-myshopify Admin host", async () => {
    let called = false;
    let error = thrownAdminError(() =>
      createAdminCustomerClient({
        accessToken: "server-secret",
        storeDomain: "shop.example.com",
        fetch: async () => {
          called = true;
          return response({});
        },
      }),
    );
    assert.equal(error.code, "configuration");
    assert.equal(called, false);
  });

  it("converts GraphQL and mutation errors to safe typed errors", async () => {
    let client = createAdminCustomerClient({
      accessToken: "server-secret",
      storeDomain: "example.myshopify.com",
      fetch: async () =>
        new Response(JSON.stringify({ errors: [{ message: "contains PII" }] })),
    });
    let error = await rejectedAdminError(
      client.getCustomerByEmail("member@example.com"),
    );
    assert.equal(error.code, "graphql");
    assert.equal(error.message, "Shopify Admin request failed");
  });
});

const AdminBodySchema = s.object({
  query: s.string(),
  variables: s.record(s.string(), s.any()),
});

type AdminBody = s.InferOutput<typeof AdminBodySchema>;

function parseAdminBody(body: BodyInit | null | undefined): AdminBody {
  return s.parse(AdminBodySchema, JSON.parse(String(body)));
}

function thrownAdminError(run: () => object): AdminApiError {
  try {
    run();
  } catch (error) {
    assert.ok(error instanceof AdminApiError);
    return error;
  }
  return assert.fail("Expected an AdminApiError to be thrown");
}

async function rejectedAdminError<Result>(
  request: Promise<Result>,
): Promise<AdminApiError> {
  try {
    await request;
  } catch (error) {
    assert.ok(error instanceof AdminApiError);
    return error;
  }
  return assert.fail("Expected the request to reject with AdminApiError");
}

function response<Data>(data: Data) {
  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
}
