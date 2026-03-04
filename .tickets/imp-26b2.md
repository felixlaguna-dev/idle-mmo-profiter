---
id: imp-26b2
status: closed
deps: []
links: []
created: 2026-03-03T20:37:10Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-qjcw
---
# Create the scheduled GitHub Actions workflow file

Create `.github/workflows/refresh-prices.yml` with the exact content below.

## Workflow File

```yaml
name: Refresh Prices

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  refresh:
    runs-on: self-hosted
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Build Docker image
        run: docker compose build app

      - name: Refresh market prices
        run: docker compose run --rm app npm run refresh-prices -- --api-key=${{ secrets.IDLE_MMO_SECRET_KEY_CLI }} --smart

      - name: Commit updated prices
        run: |
          git config user.name 'github-actions[bot]'
          git config user.email 'github-actions[bot]@users.noreply.github.com'
          git add src/data/defaults.json
          git diff --cached --quiet || (git commit -m 'chore: refresh market prices' && git push)
```

## Design Decisions

1. **Runner: `self-hosted`** -- User has a self-hosted runner configured. Existing workflows use ubuntu-latest but this one needs the self-hosted runner.
2. **Schedule: `*/15 * * * *`** -- Every 15 minutes. The `--smart` flag means most runs are no-ops (only refreshes items whose suggestedRefreshMinutes has elapsed), so most runs complete quickly without producing a commit.
3. **Docker execution** -- Follows the same pattern as ci.yml: `docker compose build app` then `docker compose run --rm app <cmd>`. No need for setup-node or npm ci on the host. All dependencies are inside the Docker image.
4. **API key via CLI flag** -- Passed as `--api-key=${{ secrets.IDLE_MMO_SECRET_KEY_CLI }}` since .env is gitignored and won't exist on the runner.
5. **Only `src/data/defaults.json` staged** -- The script only modifies this one file. Staging only it prevents accidental commits of other files.
6. **Conditional commit** -- `git diff --cached --quiet || (git commit ... && git push)` ensures no empty commits. The parentheses group commit+push so both run only when there are changes.
7. **Default GITHUB_TOKEN** -- No custom PAT in the checkout step. This prevents the auto-commit from re-triggering this workflow (built-in GitHub Actions behavior). The commit WILL trigger CI + Deploy workflows, which is desired so the site redeploys with fresh prices.

## File to Create

`/home/felix/idle-mmo-profiter/.github/workflows/refresh-prices.yml`

## Reference

- Existing CI pattern: `/home/felix/idle-mmo-profiter/.github/workflows/ci.yml`
- Refresh script: `/home/felix/idle-mmo-profiter/scripts/refresh-market-prices.ts`
- Data file: `/home/felix/idle-mmo-profiter/src/data/defaults.json`

## Acceptance Criteria

- [ ] Workflow file exists at .github/workflows/refresh-prices.yml
- [ ] Schedule: `*/15 * * * *` (every 15 minutes)
- [ ] workflow_dispatch trigger present for manual runs
- [ ] runs-on: self-hosted
- [ ] Uses `docker compose build app` + `docker compose run --rm app` pattern (matches ci.yml)
- [ ] Passes API key via `--api-key` flag from `secrets.IDLE_MMO_SECRET_KEY_CLI`
- [ ] Uses `--smart` flag
- [ ] Only stages `src/data/defaults.json`
- [ ] Skips commit when no changes (`git diff --cached --quiet`)
- [ ] Uses default GITHUB_TOKEN (no custom PAT) to prevent workflow loops
- [ ] Commit message: `chore: refresh market prices`

