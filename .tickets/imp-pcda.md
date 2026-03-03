---
id: imp-pcda
status: closed
deps: [imp-puac]
links: []
created: 2026-03-03T16:11:24Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-wx12
---
# Phase 3: Wire useLowConfidenceFilter into useActivityFilters

useLowConfidenceFilter.ts exports filterCraftables() and filterDungeons() methods but they are NOT used in useActivityFilters.ts. Instead, useActivityFilters reimplements the same filtering logic inline (lines 91-104).

The inline logic in useActivityFilters.ts:
  if (activity.activityType === 'dungeon' && activity.isLowConfidence && !lowConfidenceFilter.showLowConfidenceDungeons.value) return false
  if (activity.activityType === 'craftable' && activity.isLowConfidence && !lowConfidenceFilter.showLowConfidenceCraftables.value) return false

This is semantically identical to what filterCraftables/filterDungeons do (check isLowConfidence flag, respect toggle state).

Steps:
1. In src/composables/useActivityFilters.ts, refactor getFilteredActivities (lines 83-108):
   - After the activity-type filter, apply the low-confidence filter using the composable methods
   - Replace the two inline if-blocks (lines 91-104) with calls that delegate to the composable
   - The simplest approach: keep the inline checks but extract them into a helper that uses the composable's toggle state, OR just keep the current pattern since filterCraftables/filterDungeons operate on arrays (not single items)

   Recommended approach: Since filterCraftables/filterDungeons are array filters and getFilteredActivities filters a mixed array of RankedActivity[], the cleanest fix is:
   a. Split the mixed activities array by type
   b. Apply filterCraftables to craftable activities, filterDungeons to dungeon activities
   c. Merge back together preserving original sort order
   
   OR (simpler): Add a single-item filter method to useLowConfidenceFilter that checks one activity, then use that in the existing filter callback.

   The key goal: eliminate the duplicated logic so there is ONE source of truth for "should this low-confidence item be shown?"

2. Verify the ProfitRankingTable still correctly filters low-confidence items
3. Run existing useActivityFilters tests to confirm no regressions

## Acceptance Criteria

- useActivityFilters.ts no longer reimplements low-confidence filtering logic inline
- Low-confidence filtering delegates to useLowConfidenceFilter composable
- ONE source of truth for "should low-confidence item be shown" logic
- Existing useActivityFilters tests pass
- ProfitRankingTable filtering behavior unchanged

