import type { AppLoadContext } from "react-router";
import * as z from "zod";

/**
 * Shopify Admin API client class.
 */
export class ShopifyCustomer {
  private request: <T = any>(
    query: string,
    variables?: Record<string, any>,
  ) => Promise<T>;

  constructor(context: AppLoadContext) {
    const shopDomain = context.env.PUBLIC_STORE_DOMAIN;
    const adminAccessToken = context.env.ADMIN_ACCESS_TOKEN;

    if (!shopDomain || !adminAccessToken) {
      const missing = [];
      if (!shopDomain) missing.push("PUBLIC_STORE_DOMAIN");
      if (!adminAccessToken) missing.push("ADMIN_ACCESS_TOKEN");

      throw new Error(
        `Missing required environment variables: ${missing.join(", ")}. Please ensure your Admin API credentials are configured.`,
      );
    }

    const adminApiUrl = `https://${shopDomain}/admin/api/2025-04/graphql.json`;
    const adminHeaders = {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": adminAccessToken,
    };

    // Create the request method with closures
    this.request = async function <T = any>(
      query: string,
      variables?: Record<string, any>,
    ): Promise<T> {
      const response = await fetch(adminApiUrl, {
        method: "POST",
        headers: adminHeaders,
        body: JSON.stringify({
          query,
          variables,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Admin API request failed: ${response.status} ${response.statusText}`,
        );
      }

      const result = (await response.json()) as any;

      if (result.errors) {
        console.error(result.errors);
        throw new Error(
          `GraphQL errors: ${result.errors.map((e: any) => e.message).join(", ")}`,
        );
      }

      return result as T;
    };
  }

  // Get customer by email
  async getCustomerByEmail(email: string) {
    try {
      const result = await this.request(GET_CUSTOMER_BY_EMAIL_QUERY, { email });

      throwOnGraphQLErrors(result);

      const customerData = result.data?.customerByIdentifier;
      if (!customerData) {
        return undefined;
      }

      // Validate customer data
      const customerValidation = CustomerSchema.safeParse(customerData);
      if (!customerValidation.success) {
        console.error(customerValidation.error);
        throw new Error("Invalid customer data received");
      }

      return customerValidation.data;
    } catch (error: any) {
      throw new Error(error.message || "Failed to get customer");
    }
  }

  async createAndSubscribeCustomer(input: { email: string; tags: string[] }) {
    try {
      const result = await this.request(CREATE_CUSTOMER_MUTATION, {
        input: {
          ...input,
          emailMarketingConsent: createEmailMarketingConsentInput(),
        },
      });

      throwOnGraphQLErrors(result);

      // Check for userErrors
      const userErrors = result.data?.customerCreate?.userErrors;
      if (userErrors?.length) {
        throw new Error(userErrors[0].message || "Failed to create customer");
      }

      const customerData = result.data?.customerCreate?.customer;
      if (!customerData) {
        throw new Error(
          "Failed to create customer - no customer data returned",
        );
      }

      // Validate customer data
      const customerValidation = CustomerSchema.safeParse(customerData);
      if (!customerValidation.success) {
        console.error(customerValidation.error);
        throw new Error("Invalid customer data received");
      }

      return customerValidation.data;
    } catch (error: any) {
      throw new Error(error.message || "Failed to create customer");
    }
  }

  async updateCustomerTags(input: { id: string; tags: string[] }) {
    try {
      const result = await this.request(UPDATE_CUSTOMER_MUTATION, { input });

      throwOnGraphQLErrors(result);

      // Check for userErrors
      const userErrors = result.data?.customerUpdate?.userErrors;
      if (userErrors?.length) {
        throw new Error(userErrors[0].message || "Failed to update customer");
      }

      const customerData = result.data?.customerUpdate?.customer;
      if (!customerData) {
        throw new Error(
          "Failed to update customer - no customer data returned",
        );
      }

      // Validate customer data
      const customerValidation = CustomerSchema.safeParse(customerData);
      if (!customerValidation.success) {
        console.error(customerValidation.error);
        throw new Error("Invalid customer data received");
      }

      return customerValidation.data;
    } catch (error: any) {
      throw new Error(error.message || "Failed to update customer");
    }
  }

  // Update customer email marketing consent
  async subscribeCustomer(input: { customerId: string }) {
    try {
      const result = await this.request(
        UPDATE_EMAIL_MARKETING_CONSENT_MUTATION,
        {
          input: {
            ...input,
            emailMarketingConsent: createEmailMarketingConsentInput(),
          },
        },
      );

      throwOnGraphQLErrors(result);

      // Check for userErrors
      const userErrors =
        result.data?.customerEmailMarketingConsentUpdate?.userErrors;
      if (userErrors?.length) {
        throw new Error(
          userErrors[0].message || "Failed to update email marketing consent",
        );
      }

      const customerData =
        result.data?.customerEmailMarketingConsentUpdate?.customer;
      if (!customerData) {
        throw new Error(
          "Failed to update email marketing consent - no customer data returned",
        );
      }

      // Validate customer data
      const customerValidation = CustomerSchema.safeParse(customerData);
      if (!customerValidation.success) {
        console.error(customerValidation.error);
        throw new Error("Invalid customer data received");
      }

      return customerValidation.data;
    } catch (error: any) {
      throw new Error(
        error.message || "Failed to update email marketing consent",
      );
    }
  }
}

function createEmailMarketingConsentInput() {
  return {
    marketingState: "SUBSCRIBED",
    marketingOptInLevel: "SINGLE_OPT_IN",
    consentUpdatedAt: new Date().toISOString(),
  };
}

function throwOnGraphQLErrors(
  result: any,
  fallbackMessage = "Something went wrong. Please try again.",
) {
  if (result.errors?.length) {
    console.error(result.errors);
    throw new Error(result.errors[0].message || fallbackMessage);
  }
}

const CustomerSchema = z.object({
  id: z.string(),
  email: z.string(),
  tags: z.array(z.string()).default([]),
});

const GET_CUSTOMER_BY_EMAIL_QUERY = `#graphql
  query customerByEmail($email: String!) {
    customerByIdentifier(identifier: { emailAddress: $email }) {
      id
      email
      tags 
    }
  }
`;

const CREATE_CUSTOMER_MUTATION = `#graphql
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        tags
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_CUSTOMER_MUTATION = `#graphql
  mutation customerUpdate($input: CustomerInput!) {
    customerUpdate(input: $input) {
      customer {
        id
        email
        tags
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const UPDATE_EMAIL_MARKETING_CONSENT_MUTATION = `#graphql
  mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        email
      }
      userErrors {
        field
        message
      }
    }
  }
`;
