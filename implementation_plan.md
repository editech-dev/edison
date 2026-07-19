# Implementation Plan — Fix Vercel Production Build (`ERR_PNPM_IGNORED_BUILDS`)

**Date**: 2026-07-19
**Status**: In Progress
**Author**: OpenCode Agent

---

## 1. Problem Statement

Production deployments on Vercel fail during `pnpm install` with:

```
[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: @google/genai@2.12.0, esbuild@0.28.1, protobufjs@7.6.5, sharp@0.34.5
Error: Command "pnpm install" exited with 1
```

Preview deployments succeed. The build never reaches `next build` — it dies at dependency installation.

## 2. Root Cause Analysis

| Factor | Detail |
|---|---|
| **pnpm 11 breaking change** | `package.json` pins `packageManager: pnpm@11.12.0`. In pnpm 11, `strictDepBuilds` defaults to `true`: any dependency with lifecycle scripts (`preinstall`/`postinstall`/`install`) that is not explicitly approved/denied makes `pnpm install` exit with code 1. |
| **Removed settings** | pnpm 11 removed `onlyBuiltDependencies` (and siblings) and no longer reads config from `package.json` (`pnpm` field) or `.npmrc`/`.pnpmrc`. The replacement is `allowBuilds` in `pnpm-workspace.yaml`, which this repo does not have. |
| **Environment divergence** | `ENABLE_EXPERIMENTAL_COREPACK=1` is set **only for Production** in Vercel → production resolves the pinned pnpm 11.12.0 via Corepack. Preview has no such variable → Vercel falls back to pnpm 9.15.9, which runs dependency build scripts by default. Hence "preview works, production fails". |
| **Dead fix attempts** | `PNPM_ONLY_BUILT_DEPENDENCIES` env var (Vercel) and former `.pnpmrc`/`package.json` attempts are all ignored by pnpm 11. |

## 3. Solution Design

### 3.1 Repository fix (definitive)
Create `pnpm-workspace.yaml` at the repo root with an explicit `allowBuilds` map approving the four dependencies that ship install scripts:

```yaml
allowBuilds:
  "@google/genai": true
  esbuild: true
  protobufjs: true
  sharp: true
```

- pnpm 11: builds are approved → `strictDepBuilds` satisfied → install exits 0.
- pnpm 9 (legacy preview path): unknown key is ignored; scripts run by default. No regression.

### 3.2 Vercel environment unification (hardening)
- Add `ENABLE_EXPERIMENTAL_COREPACK=1` to **Preview** and **Development** (already in Production) so every environment uses the pinned pnpm 11.12.0 → deterministic installs everywhere.
- Remove the dead `PNPM_ONLY_BUILT_DEPENDENCIES` env var (ignored by pnpm 11).

### 3.3 Rejected alternatives
- `strictDepBuilds: false` — install would pass but scripts would not run → degraded `sharp`/`esbuild` at runtime.
- `dangerouslyAllowAllBuilds: true` — works but disables pnpm 11 supply-chain protection entirely.
- Downgrade to pnpm 10 — loses the pin and security posture for no gain.

## 4. Execution Steps

1. [x] Create this plan (`implementation_plan.md`).
2. [ ] Create `pnpm-workspace.yaml` with `allowBuilds`.
3. [ ] Local verification:
   - `rm -rf node_modules && pnpm install` → exit 0, no `ERR_PNPM_IGNORED_BUILDS`, build scripts executed.
   - `CI=true pnpm install --frozen-lockfile` → simulates Vercel CI behavior.
   - `pnpm build`, `pnpm test:run`, `pnpm lint`.
4. [ ] Vercel CLI: add `ENABLE_EXPERIMENTAL_COREPACK=1` to Preview + Development; remove `PNPM_ONLY_BUILT_DEPENDENCIES`.
5. [ ] Commit (Conventional Commits via git-manager), push to `main`, verify production deployment goes green.
6. [ ] Document the incident and fix in `README.md` (Troubleshooting section) + note in `AGENTS.md` §D + `walkthrough.md`.

## 5. Rollback Plan

`git revert` the fix commit and redeploy. No data or infra mutations are involved; Vercel env var changes are reversible via `vercel env rm`.
