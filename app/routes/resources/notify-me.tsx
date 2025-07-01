import { data } from "react-router";
import type { Route } from "./+types/notify-me";

// Helper function for making GraphQL requests to Shopify Admin API
async function shopifyAdminRequest<T = any>(
  adminApiUrl: string,
  adminHeaders: Record<string, string>,
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
    throw new Error(
      `GraphQL errors: ${result.errors.map((e: any) => e.message).join(", ")}`,
    );
  }

  return result as T;
}

// Factory function to create a Shopify Admin API client
function createShopifyAdminClient(context: Route.ActionArgs["context"]) {
  // Extract and validate environment variables
  const shopDomain = context.env.PUBLIC_STORE_DOMAIN;
  const adminAccessToken = context.env.ADMIN_ACCESS_TOKEN;

  if (!shopDomain || !adminAccessToken) {
    const missing = [];
    if (!shopDomain) missing.push("PUBLIC_STORE_DOMAIN");
    if (!adminAccessToken) missing.push("ADMIN_ACCESS_TOKEN");

    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}. ` +
        "Please ensure your Admin API credentials are configured.",
    );
  }

  // Create the API URL and headers
  const adminApiUrl = `https://${shopDomain}/admin/api/2025-04/graphql.json`;
  const adminHeaders = {
    "Content-Type": "application/json",
    "X-Shopify-Access-Token": adminAccessToken,
  };

  // Return a function that automatically applies these values
  return function request<T = any>(
    query: string,
    variables?: Record<string, any>,
  ): Promise<T> {
    return shopifyAdminRequest<T>(adminApiUrl, adminHeaders, query, variables);
  };
}

// GraphQL query to find customer by email
const GET_CUSTOMER_BY_EMAIL = `#graphql
  query customerByEmail($email: String!) {
    customerByIdentifier(identifier: { emailAddress: $email }) {
      id
      email
      tags
      firstName
      lastName
      emailMarketingConsent {
        marketingState
        marketingOptInLevel
        consentUpdatedAt
      }
    }
  }
`;

// GraphQL mutation to create a new customer
const CREATE_CUSTOMER_MUTATION = `#graphql
  mutation customerCreate($input: CustomerInput!) {
    customerCreate(input: $input) {
      customer {
        id
        email
        tags
        emailMarketingConsent {
          marketingState
          marketingOptInLevel
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// GraphQL mutation to update an existing customer's tags
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

// GraphQL mutation to update customer's email marketing consent
const UPDATE_EMAIL_MARKETING_CONSENT_MUTATION = `#graphql
  mutation customerEmailMarketingConsentUpdate($input: CustomerEmailMarketingConsentUpdateInput!) {
    customerEmailMarketingConsentUpdate(input: $input) {
      customer {
        id
        emailMarketingConsent {
          marketingState
          marketingOptInLevel
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Type definitions for API responses
interface Customer {
  id: string;
  email: string;
  tags: string[];
  firstName?: string;
  lastName?: string;
  emailMarketingConsent?: {
    marketingState: string;
    marketingOptInLevel?: string;
    consentUpdatedAt?: string;
  };
}

interface UserError {
  field?: string[];
  message: string;
}

interface CustomerQueryResponse {
  data?: {
    customerByIdentifier?: Customer | null;
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

interface CustomerMutationResponse {
  data?: {
    customerCreate?: {
      customer?: Customer;
      userErrors?: UserError[];
    };
    customerUpdate?: {
      customer?: Customer;
      userErrors?: UserError[];
    };
    customerEmailMarketingConsentUpdate?: {
      customer?: Customer;
      userErrors?: UserError[];
    };
  };
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: string[];
  }>;
}

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data(
      { error: "Method not allowed", success: false },
      { status: 405 },
    );
  }

  const form = await request.formData();

  try {
    // Extract and validate form data
    const email = form.get("email") as string;
    const variantId = form.get("variantId") as string;
    const variantTitle = form.get("variantTitle") as string;

    if (!email) {
      return data(
        { error: "Email is required", success: false },
        { status: 400 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return data(
        { error: "Please enter a valid email address", success: false },
        { status: 400 },
      );
    }

    // Create Shopify Admin API client
    const adminClient = createShopifyAdminClient(context);

    // Create product notification tag
    const productTag = variantTitle
      ? `notify-${variantId}-${variantTitle.toLowerCase().replace(/\s+/g, "-")}`
      : `notify-${variantId}`;

    const baseTag = "notify-me-subscriber";

    // Step 1: Check if customer exists
    const customerResult = await adminClient<CustomerQueryResponse>(
      GET_CUSTOMER_BY_EMAIL,
      { email },
    );

    const existingCustomer = customerResult.data?.customerByIdentifier;
    let customer: Customer;
    let actionType: "created" | "updated";

    if (existingCustomer) {
      // Step 2a: Update existing customer tags and email marketing consent
      const existingTags = existingCustomer.tags || [];
      const newTags = [...new Set([...existingTags, productTag, baseTag])];

      // First, update customer tags
      const updateResult = await adminClient<CustomerMutationResponse>(
        UPDATE_CUSTOMER_MUTATION,
        {
          input: {
            id: existingCustomer.id,
            tags: newTags,
          },
        },
      );

      if (updateResult.data?.customerUpdate?.userErrors?.length) {
        const userError = updateResult.data.customerUpdate.userErrors[0];
        console.error("Customer update errors:", userError);
        return data(
          {
            error: userError.message || "Failed to process your request.",
            success: false,
          },
          { status: 400 },
        );
      }

      // Second, update email marketing consent
      const consentResult = await adminClient<CustomerMutationResponse>(
        UPDATE_EMAIL_MARKETING_CONSENT_MUTATION,
        {
          input: {
            customerId: existingCustomer.id,
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
              consentUpdatedAt: new Date().toISOString(),
            },
          },
        },
      );

      if (
        consentResult.data?.customerEmailMarketingConsentUpdate?.userErrors
          ?.length
      ) {
        const userError =
          consentResult.data.customerEmailMarketingConsentUpdate.userErrors[0];
        console.error("Customer consent update errors:", userError);
        return data(
          {
            error: userError.message || "Failed to process your request.",
            success: false,
          },
          { status: 400 },
        );
      }

      // Combine the updated customer data
      const updatedCustomer = updateResult.data?.customerUpdate?.customer;
      const consentCustomer =
        consentResult.data?.customerEmailMarketingConsentUpdate?.customer;

      if (!updatedCustomer) {
        return data(
          {
            error: "Failed to process your request. Please try again.",
            success: false,
          },
          { status: 500 },
        );
      }

      // Merge the customer data from both responses
      customer = {
        ...updatedCustomer,
        emailMarketingConsent:
          consentCustomer?.emailMarketingConsent ||
          updatedCustomer.emailMarketingConsent,
      };
      actionType = "updated";
    } else {
      // Step 2b: Create new customer
      const createResult = await adminClient<CustomerMutationResponse>(
        CREATE_CUSTOMER_MUTATION,
        {
          input: {
            email,
            tags: [productTag, baseTag],
            emailMarketingConsent: {
              marketingState: "SUBSCRIBED",
              marketingOptInLevel: "SINGLE_OPT_IN",
              consentUpdatedAt: new Date().toISOString(),
            },
          },
        },
      );

      if (createResult.data?.customerCreate?.userErrors?.length) {
        const userError = createResult.data.customerCreate.userErrors[0];
        console.error("Customer create errors:", userError);
        return data(
          {
            error: userError.message || "Failed to process your request.",
            success: false,
          },
          { status: 400 },
        );
      }

      const createdCustomer = createResult.data?.customerCreate?.customer;
      if (!createdCustomer) {
        return data(
          {
            error: "Failed to process your request. Please try again.",
            success: false,
          },
          { status: 500 },
        );
      }

      customer = createdCustomer;
      actionType = "created";
    }

    // Step 3: Success response
    return data(
      {
        success: true,
        message: "Thanks! We'll notify you when this item is back in stock.",
        customer: {
          id: customer.id,
          email: customer.email,
          actionType,
          marketingSubscribed:
            customer.emailMarketingConsent?.marketingState === "SUBSCRIBED",
        },
      },
      { status: 200 },
    );
  } catch (error: any) {
    console.error("Notify me action error:", error);

    // Handle environment configuration errors
    if (error.message?.includes("Missing required environment variables")) {
      return data(
        {
          error: "Service temporarily unavailable. Please try again later.",
          success: false,
        },
        { status: 500 },
      );
    }

    return data(
      {
        error: error.message || "Something went wrong. Please try again.",
        success: false,
      },
      { status: 500 },
    );
  }
}
