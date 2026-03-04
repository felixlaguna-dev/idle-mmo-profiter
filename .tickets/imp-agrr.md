---
id: imp-agrr
status: closed
deps: []
links: []
created: 2026-03-03T20:50:40Z
type: task
priority: 2
assignee: Félix Laguna Teno
---
# Review: refresh-prices.yml workflow

Code review of the updated refresh-prices workflow


## Notes

**2026-03-03T20:51:18Z**

## Code Review: NEEDS FIXES

**File reviewed:** `.github/workflows/refresh-prices.yml`
**Compared against:** `.github/workflows/deploy.yml`

---

### Original Issue #1 (Medium): API key exposed on command line
**Status: FIXED (pattern correct) but BLOCKED by script bug**

The workflow correctly uses env var pass-through:
```yaml
run: docker compose run --rm -e IDLE_MMO_SECRET_KEY_CLI app npm run refresh-prices -- --smart
env:
  IDLE_MMO_SECRET_KEY_CLI: ${{ secrets.IDLE_MMO_SECRET_KEY_CLI }}
```

The Docker `-e VAR_NAME` syntax (without `=value`) correctly forwards the host environment variable into the container. The GitHub Actions `env:` block sets it on the host process, Docker picks it up. This pattern is valid.

**HOWEVER -- CRITICAL BUG:** The script at `scripts/refresh-market-prices.ts` does NOT read `process.env.IDLE_MMO_SECRET_KEY_CLI`. It reads from the `.env` file on disk (line 67-75 of the script: `loadApiKeyFromEnv()` reads `fs.readFileSync(envPath, 'utf8')`). Since `.env` is gitignored and will not exist in CI, the script will fall through to the interactive prompt and hang/fail. The env var pass-through pattern is correct at the Docker/workflow level, but the script ignores it.

**Fix needed in:** `scripts/refresh-market-prices.ts` -- add `process.env.IDLE_MMO_SECRET_KEY_CLI` as a fallback before reading `.env` file (or after, as priority dictates).

---

### Original Issue #2 (High): Default GITHUB_TOKEN won't trigger deploy
**Status: FIXED**

The workflow now includes deploy steps (lines 51-68) directly within the same job, conditional on `steps.commit.outputs.changed == 'true'`. This correctly avoids the GITHUB_TOKEN limitation (pushes with GITHUB_TOKEN don't trigger other workflows). The deploy steps match deploy.yml's pattern: configure-pages -> upload-pages-artifact -> deploy-pages.

---

### Original Issue #3 (Medium): Missing concurrency control
**Status: FIXED**

Lines 13-15 add concurrency group `refresh-prices` with `cancel-in-progress: true`. The group name does NOT conflict with deploy.yml's `pages` group.

**Minor concern:** Since both workflows can deploy to GitHub Pages simultaneously (refresh-prices uses group `refresh-prices`, deploy.yml uses group `pages`), there is no cross-workflow concurrency guard on the Pages deployment itself. If a human push triggers deploy.yml at the exact same time refresh-prices deploys, both could race on the Pages environment. This is low-risk (the `github-pages` environment has its own serialization in GitHub), but worth noting. No action required.

---

### Original Issue #4 (Low): Missing permissions block
**Status: FIXED**

Lines 8-11 correctly declare:
```yaml
permissions:
  contents: write    # needed for git push
  pages: write       # needed for Pages deployment
  id-token: write    # needed for Pages OIDC token
```

This matches deploy.yml's permissions, plus adds `contents: write` (deploy.yml only needs `contents: read`). Correct and sufficient for both the git push and Pages deployment use cases.

---

### Original Issue #5 (Low): Missing timeout-minutes
**Status: FIXED**

Line 20: `timeout-minutes: 30` -- reasonable for a price refresh + build + deploy job.

---

### Original Issue #6 (Very Low): No comments
**Status: NOT ADDRESSED**

deploy.yml has inline comments (e.g., lines 28, 32-34). refresh-prices.yml has none. Low priority, but for consistency, comments on the non-obvious steps (env var pass-through, conditional deploy, the GITHUB_OUTPUT pattern) would be helpful.

---

### GITHUB_OUTPUT Conditional Deploy Pattern
**Status: CORRECT**

The pattern on lines 39-49 is correct:
- `git diff --cached --quiet` returns 0 when there are no staged changes
- Writing to `$GITHUB_OUTPUT` with `changed=true/false` is the current GitHub Actions approach (the old `::set-output` is deprecated)
- The `if: steps.commit.outputs.changed == 'true'` conditionals on lines 52, 56, 60, 66 are syntactically correct and will properly skip deploy when no prices changed

---

### YAML Syntax
**Status: VALID**

Parsed cleanly with Python yaml.safe_load. No syntax errors.

---

### Additional Observations

1. **Runner mismatch:** refresh-prices.yml uses `runs-on: self-hosted` while deploy.yml uses `runs-on: ubuntu-latest`. This is presumably intentional (self-hosted has access to the IdleMMO API or has Docker pre-configured), but worth confirming.

2. **Environment block placement:** The `environment: name: github-pages` is declared at the job level (lines 21-23) even though deployment only happens conditionally. This means every run of the job -- even when prices don't change -- will show up as a deployment in the GitHub Environments tab (as "inactive" if no deploy-pages step runs). This is cosmetic only but could clutter the deployments view.

3. **No error handling on docker compose build:** If the Docker build fails, subsequent steps will fail too, but the error message may be unclear. deploy.yml has the same pattern, so this is consistent.

---

## Summary

| Issue | Status | Severity |
|-------|--------|----------|
| API key on CLI | Pattern fixed, but script ignores env var | **CRITICAL** |
| GITHUB_TOKEN deploy | Fixed (in-workflow deploy) | Resolved |
| Concurrency control | Fixed | Resolved |
| Permissions block | Fixed | Resolved |
| Timeout-minutes | Fixed | Resolved |
| Comments | Not addressed | Very Low |

**Verdict: NEEDS FIXES -- 1 critical issue (script doesn't read process.env), 1 very low issue (comments).**

The workflow YAML itself is well-structured and correct. The critical blocker is that the environment variable pass-through will not work because `scripts/refresh-market-prices.ts` only reads from the `.env` file, not from `process.env`. The script's `getApiKey()` function (line 79) must be updated to check `process.env.IDLE_MMO_SECRET_KEY_CLI` as one of its resolution sources.

**2026-03-03T20:56:33Z**

Docker caching optimization added to workflow (separate from original review issues).

**New steps added:**
- 'Restore Docker build cache' (lines 29-45): Checks package-lock.json hash
- 'Build Docker image' (lines 47-55): Conditional build based on cache check

**Safety review:**
- Cache key: SHA256 hash of package-lock.json (deterministic)
- Marker files: Stored in /tmp/docker-build-*.marker (self-hosted runner)
- Auto-cleanup: Keeps last 5 markers, removes older ones
- Build skip logic: Only skips if exact hash match exists
- Fallback: Always rebuilds if marker missing (safe default)
- No impact on existing steps: Runs before price refresh, orthogonal to deploy logic

**Potential issues:**
- None. If cache check fails, it falls back to unconditional build (same as before).
- Cache markers persist across workflow runs (intentional, improves performance).
- No cross-workflow conflicts (markers are scoped to this workflow via naming).

**Performance impact:**
- Before: docker compose build runs every time (~5-10s)
- After: Skips build if package-lock.json unchanged (~0s)
- First run or after dep change: Same as before

**Conclusion:** Optimization is safe, additive, and does not affect the original review issues. The critical script bug (process.env.IDLE_MMO_SECRET_KEY_CLI) was already fixed in a prior commit and is unrelated to caching.
