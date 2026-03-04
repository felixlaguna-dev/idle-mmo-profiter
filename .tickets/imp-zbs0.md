---
id: imp-zbs0
status: closed
deps: [imp-26b2]
links: []
created: 2026-03-03T20:37:32Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-qjcw
---
# Phase 3: Handle commit-triggered workflow loops

When the refresh workflow commits and pushes to master, it will trigger the CI and Deploy workflows (which is desired -- the site should redeploy with fresh prices). However, we must ensure the refresh workflow itself does NOT re-trigger in an infinite loop.

**Solution:** GitHub Actions does NOT trigger workflows on pushes made by the `github-actions[bot]` when using the default `GITHUB_TOKEN`. This is built-in behavior. So no special handling is needed IF we use the default token.

**Verify:**
- The workflow uses `${{ github.token }}` or the implicit `GITHUB_TOKEN` for checkout/push (NOT a personal access token)
- Do NOT use `actions/checkout` with a custom `token:` parameter that is a PAT
- This ensures the auto-commit does NOT trigger the refresh-prices workflow again
- But it WILL trigger ci.yml and deploy.yml (since those listen on push to master)

**Wait -- clarification needed:** Since both CI and Deploy also run on push to master, the auto-commit WILL trigger them. This is actually GOOD because:
- CI validates the updated defaults.json
- Deploy publishes the site with fresh prices

If the user does NOT want CI/Deploy to run on auto-commits, we could filter by commit author or add a `[skip ci]` tag. But the default behavior (CI + Deploy triggered) is likely desired.

**Implementation:** This is primarily a verification step. Ensure the checkout step in the refresh workflow does NOT use a custom PAT token. The default GITHUB_TOKEN behavior handles loop prevention automatically.

## Acceptance Criteria

- [ ] Workflow uses default GITHUB_TOKEN (no custom PAT in checkout)
- [ ] Verified: auto-commit will NOT re-trigger the refresh-prices workflow
- [ ] Verified: auto-commit WILL trigger CI and Deploy workflows (desired behavior)


## Notes

**2026-03-03T20:41:40Z**

Closed: Loop prevention is not a separate implementation step. It is a design constraint (use default GITHUB_TOKEN, no custom PAT) that is built into the workflow file created in imp-26b2. No separate work needed.
