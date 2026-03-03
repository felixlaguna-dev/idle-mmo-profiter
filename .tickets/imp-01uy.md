---
id: imp-01uy
status: closed
deps: []
links: []
created: 2026-03-02T16:49:24Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
tags: [iteration-2, sorting]
---
# Iteration 2: Fix sorting - low-confidence items to bottom

- Modify CraftableTable.vue sorting logic
- Low-confidence items should always sort to bottom regardless of toggle state
- When toggle is OFF, items are filtered (current behavior)
- When toggle is ON, items show but appear at bottom of list
- Same fix needed for DungeonTable.vue

## Acceptance Criteria

Low-confidence items always appear at bottom of sorted list

