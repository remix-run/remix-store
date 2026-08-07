import { test, expect } from "@playwright/test";

/**
 * Policy Pages acceptance tests
 * Validates: privacy policy, refund policy, terms of service, shipping policy
 * Behavioral assertions only - no framework/class specifics
 */

test.describe("Policy Pages", () => {
  const policies = [
    {
      name: "Privacy Policy",
      path: "/policies/privacy-policy",
      keywords: /privacy|personal|data|information/i,
    },
    {
      name: "Refund Policy",
      path: "/policies/refund-policy",
      keywords: /refund|return|exchange/i,
    },
    {
      name: "Terms of Service",
      path: "/policies/terms-of-service",
      keywords: /terms|service|agreement/i,
    },
    {
      name: "Shipping Policy",
      path: "/policies/shipping-policy",
      keywords: /shipping|delivery|dispatch/i,
    },
  ];

  for (const policy of policies) {
    test(`${policy.name} page loads and displays content`, async ({ page }) => {
      const response = await page.goto(policy.path);

      // Page should load successfully
      expect(response?.status()).toBe(200);

      // Should have heading
      const heading = page.getByRole("heading", { level: 1 });
      await expect(heading).toBeVisible();

      // Should contain relevant keywords
      const content = await page
        .locator('main, [role="main"]')
        .first()
        .textContent();
      expect(content).toMatch(policy.keywords);
    });
  }

  test("policy pages are accessible from footer", async ({ page }) => {
    await page.goto("/");

    const footer = page.locator('footer, [role="contentinfo"]');

    // Footer should contain at least one policy link
    const policyLink = footer
      .getByRole("link", { name: /privacy|refund|terms|shipping/i })
      .first();
    await expect(policyLink).toBeVisible();

    // Click and verify navigation
    await policyLink.click();
    await expect(page).toHaveURL(/\/policies\//);
  });
});
