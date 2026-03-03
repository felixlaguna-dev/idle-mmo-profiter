---
id: imp-uht6
status: closed
deps: [imp-a75y, imp-xx26]
links: []
created: 2026-03-02T11:31:07Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Phase 4: UI - CraftableTable Toggle & Badges

- Import and use useLowConfidenceFilter composable
- Add toggle switch above table (next to sub-tab navigation)
  - Label: 'Include low-confidence prices'
  - Style: match existing UI patterns (switch component)
- Add warning badge/icon to rows when toggle is ON and item is low-confidence
  - Badge: warning triangle icon or 'Low Confidence' badge
  - Yellow/amber color to indicate caution
- Filter craftables list based on toggle state (exclude by default)
- Update heatmap range calculation to use filtered list
- Add visual regression tests if needed

## Acceptance Criteria

Toggle works, badge displays correctly, filtering works


## Notes

**2026-03-02T11:48:23Z**

Implementation complete. Modified:
- src/components/CraftableTable.vue

Changes:
1. Imported useLowConfidenceFilter composable
2. Added low-confidence toggle in sub-tab navigation
3. Filtered craftables by low-confidence status (excluded by default)
4. Added warning badge (⚠) for low-confidence items
5. Added CSS styles for toggle and badge

Features:
- Toggle shows count of low-confidence items
- Badge has tooltip explaining the warning
- Rows with low-confidence items have left border highlight
