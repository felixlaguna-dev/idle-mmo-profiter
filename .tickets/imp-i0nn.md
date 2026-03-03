---
id: imp-i0nn
status: closed
deps: [imp-y20e]
links: []
created: 2026-03-02T16:49:45Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
tags: [iteration-2, ui-enhancement]
---
# Iteration 4: Add recipe confidence indicator

- Add isRecipeLowConfidence flag to CraftableProfitResult
- When a craftable has a tradable recipe with no recent sales, show separate warning
- Warning should appear on the 'with recipe cost' profit line only
- Tooltip should explain that recipe price may be stale
- Does NOT affect visibility (not filtered)

## Acceptance Criteria

Recipe confidence shown separately from craftable confidence

