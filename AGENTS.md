# Agent Notes

Load `.agents/skills/remix-store/SKILL.md` for app structure, conventions, and
verification steps.

## Pending Dependency Cleanup

### Drop pnpm overrides once `@shopify/mini-oxygen` 4.3.0 ships

The `overrides` in `pnpm-workspace.yaml` patch vulnerable transitive
dependencies of `@shopify/mini-oxygen` 4.2.3, which still runs Miniflare 3.
Hydrogen merged the move to Miniflare 4
([Shopify/hydrogen#4245](https://github.com/Shopify/hydrogen/pull/4245)); it
ships as `@shopify/mini-oxygen` 4.3.0 in the release from
[Shopify/hydrogen#4229](https://github.com/Shopify/hydrogen/pull/4229).

Whenever you touch dependencies, check `npm view @shopify/mini-oxygen version`.
Once it is 4.3.0 or newer:

1. Bump `@shopify/mini-oxygen` in `package.json` (and `@shopify/hydrogen` if
   the same release bumps it; then follow the skill's Hydrogen upgrade steps).
2. Remove the `ws` and `cookie` overrides. Miniflare 4 pins a patched `ws` and
   its `youch` 4 no longer depends on `cookie`.
3. Keep `undici` and `qs` unless the reasons below no longer hold:
   - `undici`: Miniflare 4 pins 7.28.0, which is affected by advisories fixed
     in 7.29.1 and 7.30.1. Drop the override once `pnpm why undici` without it
     resolves only to a version with no open advisories.
   - `qs`: mini-oxygen depends on `body-parser` 1.20.4, which asks for
     `qs ~6.14`. Drop it once that range resolves to a patched release.
4. Run `pnpm install`, then confirm with `pnpm why <package>` and the GitHub
   advisory database
   (`gh api "/advisories?ecosystem=npm&affects=<package>"`) that nothing
   regresses. `pnpm audit` does not work through Shopify's package proxy.
5. Verify with `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build:oxygen`,
   and `pnpm dev:oxygen` or `pnpm preview:oxygen`, since MiniOxygen runs the
   local Worker.
6. Update the comment above `overrides` in `pnpm-workspace.yaml`, and update or
   delete this section.
