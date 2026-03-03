---
id: imp-y20e
status: closed
deps: [imp-01uy]
links: []
created: 2026-03-02T16:49:33Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
tags: [iteration-2, low-confidence-logic]
---
# Iteration 3: Fix low-confidence logic - only check crafted item

- Modify craftableCalculator.ts isCraftableLowConfidence function
- Only check if the CRAFTED ITEM has recent sales
- Do NOT check the recipe's lastSaleAt for craftable confidence
- Recipe confidence should only affect the 'with recipe cost' profit display
- Add separate isRecipeLowConfidence flag for UI display
- Same logic for dungeonCalculator.ts if applicable

## Acceptance Criteria

Craftables only marked low-confidence if crafted item has no recent sales

