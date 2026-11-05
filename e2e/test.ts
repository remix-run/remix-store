import { expect, test as base } from "playwright/test";

export { expect };

/** Fails any test whose pages report a Content Security Policy violation. */
export const test = base.extend<{ cspViolations: string[] }>({
  cspViolations: [
    async ({ page }, use) => {
      let violations: string[] = [];
      await page.exposeFunction("reportCspViolation", (violation: string) => {
        violations.push(violation);
      });
      await page.addInitScript(() => {
        document.addEventListener("securitypolicyviolation", (event) => {
          let report = (window as { reportCspViolation?: (v: string) => void })
            .reportCspViolation;
          report?.(`${event.effectiveDirective} ${event.blockedURI}`);
        });
      });
      await use(violations);
      expect(violations, "Content Security Policy violations").toEqual([]);
    },
    { auto: true },
  ],
});
