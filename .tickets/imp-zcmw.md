---
id: imp-zcmw
status: closed
deps: [imp-26b2, imp-gpqz]
links: []
created: 2026-03-03T20:37:42Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-qjcw
---
# Test the workflow end-to-end

Validate the workflow works by triggering it manually after the workflow file is pushed and the secret is configured.

## Steps

1. Push the workflow file to master (done when imp-26b2 is committed)
2. Ensure the GitHub secret is set (imp-gpqz)
3. Trigger manually via GitHub Actions UI or CLI:
   ```bash
   gh workflow run refresh-prices.yml
   ```
4. Monitor the run:
   ```bash
   gh run list --workflow=refresh-prices.yml --limit=1
   gh run watch <run-id> --exit-status
   ```
5. Verify:
   - The workflow ran on the self-hosted runner
   - Docker compose built and ran successfully
   - The refresh script executed with --smart flag
   - A commit was created (if prices changed) with message 'chore: refresh market prices'
   - The commit triggered CI and Deploy workflows
   - The site was redeployed with fresh prices
   - No infinite workflow loop occurred (refresh-prices did NOT re-trigger itself)

## Troubleshooting

- If the self-hosted runner is offline, the workflow will queue and eventually time out
- If Docker is not available on the runner, the build step will fail
- If the API key is wrong, the script will exit with code 1 (AuthError)
- If no prices changed (likely with --smart on a recent run), no commit should be made -- verify this case too

## Acceptance Criteria

- [ ] Manual workflow dispatch succeeds
- [ ] Docker build and run complete on the self-hosted runner
- [ ] Script runs and refreshes prices (or correctly no-ops with --smart)
- [ ] Commit is created and pushed when prices change
- [ ] No commit is created when prices are unchanged
- [ ] CI and Deploy workflows are triggered by the auto-commit
- [ ] Refresh-prices workflow does NOT re-trigger itself (no loop)

