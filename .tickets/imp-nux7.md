---
id: imp-nux7
status: closed
deps: [imp-ixfr]
links: []
created: 2026-03-04T16:18:56Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-8dpq
---
# Phase 5: Update chart components to handle alchemy/forging distinction (optional visual enhancement)

## Summary
The charts (ProfitBarChart.vue and RevenueBreakdown.vue) currently group all craftables together by checking `activityType === 'craftable'`. This phase decides whether to keep them grouped or split them.

## Recommended approach: Keep grouped
Since the `activityType` remains 'craftable' for both alchemy and forging, the charts will naturally continue to group them together. No code changes needed unless the user wants the charts to also show the alchemy/forging split.

## Files potentially affected (only if splitting charts)
- `/home/felix/idle-mmo-profiter/src/components/charts/ProfitBarChart.vue`
  - Color bars differently for alchemy vs forging based on `activity.skill`
- `/home/felix/idle-mmo-profiter/src/components/charts/RevenueBreakdown.vue`
  - Split the 'Craftables' category into 'Alchemy' and 'Forging' categories

## Implementation if splitting is desired
Both charts would need to check `activity.skill` on the RankedActivity. Since Phase 1 adds the `skill` field to RankedActivity, this data is available.

For ProfitBarChart, add alchemy/forging color variants in the switch statement.
For RevenueBreakdown, add alchemy/forging counters and totals.

## Decision needed
This is an optional enhancement. The charts currently work fine with the grouping. If the user wants distinct chart colors for alchemy vs forging, implement this phase. Otherwise, skip it.

NOTE FOR IMPLEMENTER: Skip this phase unless explicitly requested. The filter toggle split (Phases 1-4) is the core feature.

## Acceptance Criteria

Charts continue to work correctly with the new skill field; if splitting is desired, alchemy and forging have distinct visual treatment in both charts


## Notes

**2026-03-04T16:30:14Z**

Phase 5 complete. Updated chart components to distinguish alchemy vs forging with distinct colors.

Files modified:
- /home/felix/idle-mmo-profiter/src/components/charts/ProfitBarChart.vue - Split bar colors by skill (alchemy = emerald #10b981, forging = teal #14b8a6), updated legend to show Alchemy + Forging instead of Craftables
- /home/felix/idle-mmo-profiter/src/components/charts/RevenueBreakdown.vue - Split Craftables category into Alchemy + Forging categories with distinct colors matching ProfitBarChart

Color choices:
- Alchemy: Emerald green (rgba(16, 185, 129, ...))
- Forging: Teal (rgba(20, 184, 166, ...))
- Both are in the green/teal family to maintain visual relationship as crafting subcategories

All 458 tests passing
