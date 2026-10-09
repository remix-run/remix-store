---
name: testing-practices
description: Write, review, or refactor tests that maximize confidence per maintenance cost. Use for test strategy, unit/integration/browser/E2E tests, fixtures, mocks, flaky tests, skipped tests, brittle assertions, or deciding what behavior deserves coverage.
---

# Testing Practices

Optimize for **confidence per unit of maintenance**, not test count or line coverage:

> The more tests resemble how software is used, the more confidence they provide.

“Write tests. Not too many. Mostly integration.” Integration means multiple owned units exercising a real contract together; exact labels matter less than useful, reliable failures.

## Choose the test from the risk

1. Name the regression that would matter to a user or consumer.
2. Identify the public boundary where that regression is observable.
3. Choose the lowest-cost test that faithfully crosses that boundary.
4. Test the normal path and the important failure/edge states—not every branch.

| Test | Use when | Exercise |
| --- | --- | --- |
| Static analysis | Baseline; run checks per repository policy and change risk | Types, lint, schemas, builds |
| Unit | Dense pure logic or combinatorial cases | Public input/output; real cheap collaborators |
| Integration | Default for application behavior | Real owned modules across HTTP, rendering, storage, routing, or state boundaries |
| UI integration | Behavior needs rendered UI but not a full app | Real rendering, state, and user events |
| Real browser | Behavior depends on browser APIs or browser/runtime integration | DOM, focus, navigation, browser events |
| E2E | A few critical journeys or runtime wiring risks | App through public UI/API with as little substitution as practical |

Do not impose fixed percentages. A parser, UI app, and distributed service need different shapes.

## Test contracts, not construction

Assert what a real user or developer consumer can observe:

- status, headers, response body, persisted state;
- accessible roles/names, visible content, navigation, focus, disabled/loading/error state;
- documented callback/module output or side effect.

Avoid asserting private state, helper calls, component names, generated classes, exact serialization, incidental DOM nesting, query text, or asset hashes unless one is itself a documented contract. A good refactor that preserves behavior should usually preserve the test.

For UI, interact through the rendered DOM. Prefer role/name/label, then stable text, then a test ID when no user-facing locator exists. CSS/XPath selectors are a last resort. Use retrying/web-first assertions for asynchronous UI rather than sleeps.

## Keep real code inside the boundary

- Do not mock code owned by the unit under test merely to make setup easier.
- Substitute external, destructive, nondeterministic, slow, or unavailable boundaries: payment, email, clocks, random values, third-party APIs.
- Prefer a small fake server, in-memory adapter, or injected dependency over module-level mock webs.
- Model both success and meaningful failure responses at the boundary.
- If fixture setup starts reimplementing production behavior, move the test outward or simplify the seam.

A mock interaction assertion is valid only when the interaction is the public contract. Otherwise assert the resulting behavior.

## Make failures trustworthy

Tests must be deterministic, isolated, and independently runnable:

- control time, randomness, network, external data, and environment;
- create state per test and clean it up;
- never depend on execution order or another test’s output;
- synchronize on promises, events, or observable state—not arbitrary delays;
- keep live-service smoke tests separate from required deterministic tests;
- never perform real destructive or billable actions without explicit approval.

Do not skip or quarantine tests as routine maintenance. Do not keep placeholder tests for speculative or abandoned behavior; tests may lead implementation when they specify an approved contract. A flaky test is a defect: fix its synchronization/isolation or delete it if it protects no meaningful contract.

## Keep the suite small and readable

- One test should express one behavior, though it may contain several assertions proving that behavior.
- Name tests as use cases: action/condition → observable result.
- Prefer Arrange–Act–Assert without nested ceremony.
- Share mechanics (app creation, valid fixture builders, external boundary adapters), not the facts central to the scenario.
- Keep scenario-specific values and overrides in the test.
- Accept small duplication when abstraction would hide intent.
- Do not add tests for trivial framework/library behavior already guaranteed elsewhere.
- Do not use code-coverage targets as a goal. Review important **use-case coverage** instead.

## Required review

Before finishing, verify:

1. **Regression:** What real breakage makes this test fail?
2. **Boundary:** Does it use a public/user-observable contract?
3. **Sensitivity:** Would a behavior-preserving refactor still pass? Would the intended bug fail?
4. **Fidelity:** Are owned collaborators real where practical?
5. **Determinism:** Are external data, time, randomness, and async completion controlled?
6. **Value:** Is this behavior important and not already proven more effectively elsewhere?
7. **Validation:** Run the narrow test first, then the repository’s relevant full checks.

When reviewing a suite, prioritize false confidence, implementation coupling, flaky synchronization, skipped tests, and missing critical journeys over raw test or coverage counts.

## Sources

- Kent C. Dodds, [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- Kent C. Dodds, [Write tests. Not too many. Mostly integration.](https://kentcdodds.com/blog/write-tests)
- Kent C. Dodds, [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details)
- Kent C. Dodds, [How to know what to test](https://kentcdodds.com/blog/how-to-know-what-to-test)
- [Testing Library guiding principles](https://testing-library.com/docs/guiding-principles)
- [Playwright best practices](https://playwright.dev/docs/best-practices)
