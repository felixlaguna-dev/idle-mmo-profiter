---
id: imp-ggvo
status: closed
deps: [imp-a75y, imp-xx26]
links: []
created: 2026-03-02T11:31:18Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-0wtn
---
# Phase 5: UI - DungeonTable Toggle & Badges

- Import and use useLowConfidenceFilter composable
- Add toggle switch above table
  - Label: 'Include low-confidence prices'
  - Style: match existing UI patterns (switch component)
- Add warning badge/icon to dungeon rows when toggle is ON and dungeon has low-confidence drops
- Add warning badge to individual drops in expanded view if low-confidence
- Filter dungeons list based on toggle state (exclude by default)
- Update heatmap range calculation to use filtered list
- Add visual regression tests if needed

## Acceptance Criteria

Toggle works, badges display correctly, filtering works


## Notes

**2026-03-02T11:51:25Z**

Implementation complete. Modified:
- src/components/DungeonTable.vue

Changes:
1. Imported useLowConfidenceFilter composable
2. Added low-confidence toggle above table
3. Filtered dungeons by low-confidence status (excluded by default)
4. Added warning badge (⚠) for low-confidence dungeons
5. Added warning badge for individual low-confidence drops in expanded view
6. Added CSS styles for toggle and badge
