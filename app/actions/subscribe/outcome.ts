import type { FormSubmission } from "remix/data-schema/experimental/form";

import { formFailure } from "../../data/subscription.ts";

export const NEWSLETTER_MESSAGE =
  "Thanks for subscribing! We’ll keep you updated on our latest news.";
export const BACK_IN_STOCK_MESSAGE =
  "Thanks! We’ll let you know when it’s back in stock.";

/** What the signup form shows: a confirmation, or what went wrong. */
export interface Outcome {
  message?: string;
  submission?: FormSubmission;
}

const failures: Record<string, string> = {
  invalid: "Please check your details and try again.",
  limited: "Too many attempts. Please try again later.",
  error: "Something went wrong. Please try again.",
};

/**
 * A signup without scripts can't hand its result to the form's frame, so it
 * goes in the page's URL as a key from the response status. No form data.
 */
export function outcomeKey(status: number): string {
  if (status === 200) return "success";
  return status === 400 ? "invalid" : status === 429 ? "limited" : "error";
}

export function outcomeFromKey(key: string | null, product: unknown): Outcome {
  if (key === "success") {
    return { message: product ? BACK_IN_STOCK_MESSAGE : NEWSLETTER_MESSAGE };
  }
  if (key && Object.hasOwn(failures, key)) {
    return { submission: formFailure(failures[key]!) };
  }
  return {};
}
