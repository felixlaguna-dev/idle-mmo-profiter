---
id: imp-qjcw
status: closed
deps: []
links: []
created: 2026-03-03T20:35:48Z
type: epic
priority: 2
assignee: Félix Laguna Teno
---
# Feature: Scheduled GitHub Action for automated price refresh

Build a scheduled GitHub Action that uses a self-hosted runner to refresh market prices via the API key (stored as a GitHub secret) and commits the updated data back to the repo.


## Notes

**2026-03-03T20:36:51Z**

## Scouter Analysis

### Files Involved
- `scripts/refresh-market-prices.ts` -- The main refresh script. Reads API key from `.env` (IDLE_MMO_SECRET_KEY_CLI) or `--api-key=<key>` CLI flag. Has `--smart` mode for incremental refresh.
- `src/data/defaults.json` -- The ONLY data file updated by the script (14,818 lines). Contains materials, craftables, resources, recipes, resourceGathering, craftableRecipes.
- `src/api/client.ts` -- Rate-limited API client, configured by the script at runtime.
- `src/api/services.ts` -- API service layer (getMarketHistory).
- `src/utils/refreshFrequency.ts` -- Utility for computing refresh intervals.
- `.github/workflows/ci.yml` -- Existing CI workflow (runs-on: ubuntu-latest, uses Docker).
- `.github/workflows/deploy.yml` -- Existing deploy workflow (runs-on: ubuntu-latest, uses Docker).
- `package.json` -- Has `refresh-prices` script: `tsx scripts/refresh-market-prices.ts`.
- `Dockerfile` -- Node 22 Alpine, used by CI/deploy.
- `.env` -- Contains IDLE_MMO_SECRET_KEY_CLI (gitignored).

### Key Technical Details
- API key resolution order: 1) .env file, 2) --api-key=CLI arg, 3) interactive prompt
- The --api-key=<value> flag is the best approach for CI since no .env file exists in the runner
- The --smart flag is ideal for scheduled runs (only refreshes items whose suggestedRefreshMinutes has elapsed)
- Rate limit: 20 req/min. Full refresh takes ~N minutes depending on item count. Smart mode is faster.
- Script exits with code 1 on fatal error (good for CI failure detection)
- Self-hosted runner labels need to be confirmed with user (GitHub API rate-limited during investigation)

**2026-03-03T20:38:09Z**

## Planning Complete

### Summary
4 task tickets created under this epic:

1. **imp-26b2** -- Phase 1: Create the workflow file (.github/workflows/refresh-prices.yml)
2. **imp-gpqz** -- Phase 2: Add GitHub Actions secret (manual user step)
3. **imp-zbs0** -- Phase 3: Verify commit-triggered workflow loop prevention
4. **imp-zcmw** -- Phase 4: End-to-end testing

### Dependency Structure
- Phase 1 (workflow file) -- no dependencies, can start immediately
- Phase 2 (secret) -- no code dependencies, but is a manual user step
- Phase 3 (loop prevention) -- depends on Phase 1
- Phase 4 (e2e test) -- depends on Phases 1, 2, and 3

### Design Decisions
- **Cron frequency: every 6 hours** (0 */6 * * *). The script's --smart mode means only stale items get refreshed, so 6h is a good balance between freshness and API usage.
- **--smart flag**: Uses the per-item suggestedRefreshMinutes field to skip items that were recently refreshed. This drastically reduces API calls per run.
- **--api-key CLI flag**: Since .env is gitignored and won't exist on the runner, we pass the secret directly via the CLI argument.
- **GITHUB_TOKEN (default)**: Prevents infinite workflow loops. Auto-commits won't re-trigger refresh-prices but WILL trigger CI + Deploy (desired).
- **Single file changed**: Only src/data/defaults.json is modified. We stage only that file for safety.

### Questions for User
1. **Self-hosted runner label**: The existing workflows use `ubuntu-latest`. What is the label for the self-hosted runner? (e.g., `self-hosted`, or a custom label like `mini-pc`)
2. **Cron frequency**: Is every 6 hours acceptable? Or would you prefer a different interval (e.g., every 4 hours, every 12 hours)?
3. **Node.js on runner**: Does the self-hosted runner have Node.js 22 and npm pre-installed, or should the workflow install it via `actions/setup-node`?

### Risks
- **Self-hosted runner availability**: If the runner machine is offline, scheduled runs will queue and eventually fail. No mitigation needed beyond monitoring.
- **API rate limiting**: The --smart mode mitigates this. A full refresh could take 10+ minutes. Smart mode typically completes much faster.
- **Large diff commits**: defaults.json is ~15K lines. Price changes will create large diffs but this is expected and unavoidable.

### Files to Create/Modify
- CREATE: `/home/felix/idle-mmo-profiter/.github/workflows/refresh-prices.yml`
- NO code changes to existing files needed -- the refresh script already supports --api-key and --smart flags

**2026-03-03T20:40:05Z**

User feedback: (1) Runner label unknown - check existing config. (2) Cron: every 15 minutes with --smart. (3) Runner is Docker-based, workflow should also run in Docker.

**2026-03-03T20:41:02Z**

Scouter findings: (1) Existing workflows use ubuntu-latest, not self-hosted. (2) All CI runs via Docker: docker compose build app + docker compose run --rm app <cmd>. (3) API key var: IDLE_MMO_SECRET_KEY_CLI. (4) Script supports --api-key and --smart CLI flags. (5) Only src/data/defaults.json is modified. Updated plan: cron */15, self-hosted runner label, Docker execution model.

**2026-03-03T20:42:52Z**

## Plan Iteration -- Final

### Changes Made
- **imp-26b2** (Create workflow file): Fully rewritten. Now uses Docker execution model (docker compose build app + docker compose run --rm app), 15-minute cron schedule, self-hosted runner. Contains the exact YAML to implement.
- **imp-zbs0** (Loop prevention): CLOSED. Not a separate task -- it is just a design constraint (use default GITHUB_TOKEN) already captured in imp-26b2.
- **imp-gpqz** (Add secret): Unchanged. Still a manual user step.
- **imp-zcmw** (E2E testing): Updated to reflect Docker approach, removed dependency on closed imp-zbs0.

### Final Task Structure
1. imp-26b2 -- Create workflow file (the only code task)
2. imp-gpqz -- Add GitHub secret (manual user step, no code dependency)
3. imp-zcmw -- E2E test (depends on imp-26b2 + imp-gpqz)

### Implementation Summary
This is essentially a single-file implementation: create /home/felix/idle-mmo-profiter/.github/workflows/refresh-prices.yml with the YAML specified in imp-26b2. The workflow file content is finalized and ready to implement as-is.

**2026-03-03T20:45:50Z**

## Code Review: NEEDS FIXES

**File reviewed:** `.github/workflows/refresh-prices.yml`

**YAML Syntax:** PASS (validated with Python yaml.safe_load)
**Linter:** PASS (ESLint clean)
**Tests:** 1 pre-existing failure (priceConfidence.test.ts boundary test, unrelated to this change)

---

### Issue 1: [Security] API key passed on command line (Line 20)

**Problem:** The secret is passed as a CLI argument: `--api-key=${{ secrets.IDLE_MMO_SECRET_KEY_CLI }}`. While GitHub Actions masks secrets in workflow logs, on a self-hosted runner the secret will be visible in the process table (`ps aux`) to any user on the machine. This is a known security anti-pattern for self-hosted runners.

**Suggestion:** Pass the secret as an environment variable instead. Add `env: IDLE_MMO_SECRET_KEY_CLI: ${{ secrets.IDLE_MMO_SECRET_KEY_CLI }}` to the step, then update the refresh script to also check `process.env.IDLE_MMO_SECRET_KEY_CLI` before falling back to `--api-key`. Alternatively, use `-e IDLE_MMO_SECRET_KEY_CLI=${{ secrets.IDLE_MMO_SECRET_KEY_CLI }}` in the docker compose run command and have the script read it from the environment.

**Severity:** Medium (self-hosted runner specific)

---

### Issue 2: [Critical/Functional] Default GITHUB_TOKEN will NOT trigger CI or Deploy workflows

**Problem:** The epic planning notes state: "Auto-commits won't re-trigger refresh-prices but WILL trigger CI + Deploy (desired)." This is incorrect. GitHub Actions events triggered by the default `GITHUB_TOKEN` do NOT trigger any other workflow runs -- including CI and Deploy. This is a deliberate GitHub design to prevent infinite loops. See: https://docs.github.com/en/actions/security-for-github-actions/security-guides/automatic-token-authentication#using-the-github_token-in-a-workflow

**Result:** Price refreshes will be committed and pushed, but the updated site will NOT be redeployed to GitHub Pages until the next unrelated push to master.

**Suggestion:** If triggering CI + Deploy is desired, use a Personal Access Token (PAT) or a GitHub App installation token stored as a repository secret. Use it in the checkout step: `with: token: ${{ secrets.PAT_TOKEN }}`. The push will then use that token and trigger downstream workflows.

**Severity:** High (site will serve stale prices until next manual push)

---

### Issue 3: [Best Practice] Missing concurrency control

**Problem:** No `concurrency` block is defined. If a run takes longer than 15 minutes (possible during initial runs or when many items are due for refresh), a second workflow run will start while the first is still running. This could cause git push conflicts, duplicate API calls, and wasted runner resources.

**Suggestion:** Add a concurrency block:
```yaml
concurrency:
  group: refresh-prices
  cancel-in-progress: true
```
This matches the pattern used in `deploy.yml`.

**Severity:** Medium

---

### Issue 4: [Best Practice] Missing explicit permissions block

**Problem:** The workflow has no `permissions` block. It relies on the default GITHUB_TOKEN permissions. The `deploy.yml` workflow explicitly declares its permissions. For security (principle of least privilege), permissions should be explicit, especially since this workflow pushes commits.

**Suggestion:** Add:
```yaml
permissions:
  contents: write
```

**Severity:** Low (works without it on most repos, but best practice)

---

### Issue 5: [Best Practice] Missing job timeout

**Problem:** No `timeout-minutes` is set. The refresh script makes many API calls with rate limiting. If the API is down or unresponsive, the job could hang indefinitely, tying up the self-hosted runner.

**Suggestion:** Add `timeout-minutes: 30` (or appropriate value) to the job definition:
```yaml
jobs:
  refresh:
    runs-on: self-hosted
    timeout-minutes: 30
```

**Severity:** Low

---

### Issue 6: [Style] No comments on steps (inconsistency with existing workflows)

**Problem:** Both `ci.yml` and `deploy.yml` include comments explaining what each step does. The new workflow has no comments. Minor style inconsistency.

**Suggestion:** Add brief comments to steps, e.g., explaining why `--smart` is used and what the git diff guard does.

**Severity:** Very Low (cosmetic)

---

### Summary of Required Actions

| # | Issue | Severity | Action Required |
|---|-------|----------|-----------------|
| 1 | API key on CLI | Medium | Pass as env var instead |
| 2 | GITHUB_TOKEN won't trigger CI/Deploy | High | Use PAT or accept stale deploys |
| 3 | No concurrency control | Medium | Add concurrency block |
| 4 | No permissions block | Low | Add explicit permissions |
| 5 | No job timeout | Low | Add timeout-minutes |
| 6 | No step comments | Very Low | Add comments for consistency |

**Recommendation:** Issues 2 and 3 should be addressed before merging. Issue 1 depends on the self-hosted runner's security posture (single-user machine = acceptable risk). Issues 4-6 are best-practice improvements.

**2026-03-03T20:48:08Z**

User decision: Deploy in same workflow. No PAT needed. Refresh workflow will build and deploy to GitHub Pages directly after committing new prices.

**2026-03-03T20:52:17Z**

Fixed: script now reads process.env.IDLE_MMO_SECRET_KEY_CLI for CI compatibility

**2026-03-03T20:52:32Z**

Review complete. All critical issues resolved. Ready for user review.

**2026-03-03T20:54:42Z**

User feedback: Optimize Docker image caching — split layers, cache node_modules. No pushing to registry. Self-hosted runner retains local Docker cache.

**2026-03-03T20:56:13Z**

Docker caching optimization complete.

**Changes made:**

1. **Dockerfile** (/home/felix/idle-mmo-profiter/Dockerfile):
   - Added detailed comments explaining the 3-layer caching strategy
   - Layer 1: package*.json (cache key for Layer 2)
   - Layer 2: npm ci (expensive, cached until Layer 1 changes)
   - Layer 3: COPY source (rebuilds every time, but unused due to volume mount)
   - Docker automatically caches Layers 1-2 on self-hosted runner

2. **Workflow** (/home/felix/idle-mmo-profiter/.github/workflows/refresh-prices.yml):
   - Added smart cache check based on package-lock.json SHA256 hash
   - Creates /tmp/docker-build-<hash>.marker files to track successful builds
   - Skips 'docker compose build' entirely if package-lock.json unchanged
   - Automatically cleans up old cache markers (keeps last 5)
   - Result: Near-instant workflow start when dependencies unchanged

**How it works:**
- First run: Builds image (~30-60s depending on deps)
- Subsequent runs (same deps): Skips build entirely (~0s)
- After dep change: Rebuilds once, then cached again
- Docker's native layer cache still active for multi-stage efficiency

**Performance impact:**
- Before: Every run rebuilds final COPY layer (~5-10s overhead)
- After: Skips build entirely unless package-lock.json changes (~0s overhead)
- Node_modules layer remains cached by Docker between runs on self-hosted runner

No registry pushing needed — all caching is local to the self-hosted runner.

**2026-03-03T21:08:04Z**

## Testing Report: ALL TESTS PASSED

### Test 1: YAML Validation -- PASS
Validated /home/felix/idle-mmo-profiter/.github/workflows/refresh-prices.yml using Python yaml.safe_load.

Structural checks all passed:
- Valid YAML syntax
- Cron schedule: */15 * * * * (every 15 minutes)
- Permissions: contents:write, pages:write, id-token:write
- Concurrency: group=refresh-prices, cancel-in-progress=true
- runs-on: self-hosted
- timeout-minutes: 30
- environment: github-pages
- 8 steps: Checkout, Build Docker, Refresh prices, Commit, Build app, Setup Pages, Upload artifact, Deploy
- Env var IDLE_MMO_SECRET_KEY_CLI correctly passed via both docker -e flag and step env block
- Conditional deploy steps gated on steps.commit.outputs.changed == 'true'

### Test 2: Docker Build -- PASS
`docker compose build app` completed successfully.
All 5 layers built (WORKDIR, COPY package*.json, npm ci, COPY source).
Layers 2-4 were cached (fast rebuild).

### Test 3: Env Var Pass-through + Script Execution -- PASS
Command: `docker compose run --rm -e IDLE_MMO_SECRET_KEY_CLI=<key> app npm run refresh-prices -- --smart --limit=1`

Key output confirming env var path:
```
Using API key from process.env.IDLE_MMO_SECRET_KEY_CLI
```

Script successfully:
- Read the env var from process.env (NOT from .env file, confirming priority order works)
- Ran in smart mode (analyzed 164 due / 253 not yet due)
- Processed 1 item (Moose antler: 120.5 -> 136.3)
- Wrote updated prices to defaults.json
- Exited with code 0 (success)

Note: defaults.json was restored to its pre-test state via git checkout after the test.

### Summary
All acceptance criteria verified. The workflow YAML is valid, Docker builds correctly, and the env var pass-through from docker compose run -e works as expected in the refresh script.

**2026-03-03T21:23:20Z**

User Review: Perfect - work approved
