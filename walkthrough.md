# Walkthrough — Fix Vercel Production Build (`ERR_PNPM_IGNORED_BUILDS`)

**Date**: 2026-07-19
**Related**: `implementation_plan.md` · README.md → Troubleshooting

---

## What happened

Production deployments on Vercel failed at `pnpm install` with `ERR_PNPM_IGNORED_BUILDS`
(`@google/genai`, `esbuild`, `protobufjs`, `sharp`), while Preview deployments succeeded.

## Root cause

1. **pnpm 11 breaking changes** (repo pins `packageManager: pnpm@11.12.0`):
   - `strictDepBuilds` defaults to `true` → unreviewed dependency build scripts abort `pnpm install` with exit code 1.
   - `onlyBuiltDependencies` was removed; settings are no longer read from `package.json` (`pnpm` field) or `.npmrc`/`.pnpmrc`.
2. **Vercel env divergence**: `ENABLE_EXPERIMENTAL_COREPACK=1` existed only for **Production** → Production used pinned pnpm 11.12.0; Preview fell back to pnpm 9.15.9 (runs build scripts by default).
3. **Dead fix attempts found**: `pnpm.onlyBuiltDependencies` in `package.json` (commit `2c3ff4d`), `.pnpmrc` (commit `b55ce6b`, removed in `22dc828`), and a `PNPM_ONLY_BUILT_DEPENDENCIES` Vercel env var — all ignored by pnpm 11.

## Changes applied

| Change | Where | Detail |
|---|---|---|
| Fix | `pnpm-workspace.yaml` (new) | `allowBuilds` approves `@google/genai`, `esbuild`, `protobufjs`, `sharp` |
| Hardening | Vercel project `edison-dev` | `ENABLE_EXPERIMENTAL_COREPACK=1` added to Preview + Development (Production already had it) |
| Cleanup | Vercel project `edison-dev` | Removed dead `PNPM_ONLY_BUILT_DEPENDENCIES` env var |
| Docs | `README.md` | New Troubleshooting section; install instructions now pnpm-only + Corepack note; stale "Next.js 15" corrected to 16 |
| Docs | `AGENTS.md` §D | pnpm 11 / `allowBuilds` / Corepack conventions |
| Plan | `implementation_plan.md` | Full RCA + plan record |

## Verification (local, pnpm 11.12.0 + Node 24)

- ✅ `rm -rf node_modules && pnpm install` → exit 0, no `ERR_PNPM_IGNORED_BUILDS`
- ✅ `rm -rf node_modules && CI=true pnpm install --frozen-lockfile` (Vercel CI simulation) → exit 0, clean
- ✅ Native builds executed: `sharp` loads libvips 8.17.3, `esbuild` 0.28.1 transforms
- ✅ `pnpm build` → 45/45 static pages, TypeScript clean
- ✅ `pnpm test:run` → 6 files, 41/41 tests passed
- ⚠️ `pnpm lint` → **pre-existing failure, unrelated**: Next.js 16 removed the `next lint` command (`Invalid project directory provided ... /lint`). Requires a standalone ESLint flat-config setup; out of scope for this fix.

## Deployment acceptance

After push to `main`, the Vercel production deployment must pass `pnpm install` (Corepack → pnpm 11.12.0 → `allowBuilds` satisfied) and reach `READY` state.

## Rollback

`git revert` the fix commit and redeploy; Vercel env var changes are reversible with `vercel env rm`.

## Follow-up suggestion (not applied)

`GITHUB_TOKEN`, `GITHUB_REPO_OWNER`, `GITHUB_API_URL` are Production-only, so Preview builds log
`Missing GITHUB_TOKEN ...` / `Missing GITHUB_REPO_OWNER ...` warnings (lower GitHub rate limits).
Scope them to Preview as well if desired.
