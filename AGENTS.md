# Agent Notes

Load `.agents/skills/remix-store/SKILL.md` for app structure, conventions, and
verification steps.

## Pending Dependency Cleanup

### Drop the remaining pnpm overrides when upstream catches up

The `undici` and `qs` overrides in `pnpm-workspace.yaml` patch vulnerable
transitive dependencies of `@shopify/mini-oxygen` 4.3.0:

- `undici`: Miniflare 4 pins 7.28.0, which is affected by advisories fixed in
  7.29.1 and 7.30.1.
- `qs`: mini-oxygen depends on `body-parser` 1.20.4, which asks for `qs ~6.14`.

Whenever you touch dependencies (especially when bumping
`@shopify/mini-oxygen`):

1. Remove one override, run `pnpm install`, and check what `pnpm why <package>`
   resolves to without it.
2. Check that version against the GitHub advisory database
   (`gh api "/advisories?ecosystem=npm&affects=<package>"`). `pnpm audit` does
   not work through Shopify's package proxy. Restore the override if the
   resolved version still has open advisories.
3. Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:oxygen`,
   and `pnpm dev:oxygen` or `pnpm preview:oxygen`, since MiniOxygen runs the
   local Worker.
4. Update the comment above `overrides` in `pnpm-workspace.yaml`, and delete
   this section once no overrides remain.
