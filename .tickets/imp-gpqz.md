---
id: imp-gpqz
status: closed
deps: []
links: []
created: 2026-03-03T20:37:18Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-qjcw
---
# Phase 2: Add GitHub Actions secret for the API key

Store the IdleMMO API key as a GitHub Actions repository secret.

**Secret name:** `IDLE_MMO_SECRET_KEY_CLI`
**Secret value:** The value from the local `.env` file's `IDLE_MMO_SECRET_KEY_CLI` variable.

**How to add:**
1. Go to the repository on GitHub
2. Settings > Secrets and variables > Actions
3. Click 'New repository secret'
4. Name: `IDLE_MMO_SECRET_KEY_CLI`
5. Value: (paste the API key)
6. Click 'Add secret'

Or via CLI (if gh API rate limit allows):
```bash
gh secret set IDLE_MMO_SECRET_KEY_CLI --body '<api-key-value>'
```

**Note:** This is a manual/user step -- the implementer cannot create the secret automatically since it requires the actual API key value. The implementer should document this clearly.

## Acceptance Criteria

- [ ] Secret IDLE_MMO_SECRET_KEY_CLI exists in the GitHub repository settings
- [ ] The secret value matches the local .env IDLE_MMO_SECRET_KEY_CLI value

