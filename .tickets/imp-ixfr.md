---
id: imp-ixfr
status: closed
deps: [imp-tnxy]
links: []
created: 2026-03-04T16:18:44Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-8dpq
---
# Phase 4: Update App.vue bestAction and any remaining consumers of filterCraftables

## Summary
Ensure App.vue and any other files that consume useActivityFilters work with the new alchemy/forging split. The hero banner's best action must respect the split filters.

## Files to modify
- `/home/felix/idle-mmo-profiter/src/App.vue` - Uses `getFilteredAndRerankedActivities` from useActivityFilters. Since this function is internal and reads the singleton state, it should work without changes as long as Phase 2 is done correctly. However, verify there are no direct references to `filterCraftables`.

## Implementation details

### 1. Check App.vue for direct filterCraftables usage
Search for any direct binding to `filterCraftables` in App.vue. Currently App.vue only destructures `getFilteredAndRerankedActivities` (line 107), so no changes should be needed. But verify.

### 2. Check all consumers of useActivityFilters
Grep the codebase for all imports of `useActivityFilters` and `filterCraftables`. Update any remaining references:
- `src/App.vue` - only uses `getFilteredAndRerankedActivities` (no change needed)
- `src/components/ProfitRankingTable.vue` - handled in Phase 3
- Any test files - handled in Phase 2

### 3. Verify the type badge still shows 'craftable' in the ranking table
The `getTypeBadgeClass` function in ProfitRankingTable.vue and the type badge rendering should continue to show 'craftable' as the activity type in the table. The alchemy/forging distinction is only for the FILTER buttons, not the type column. This should work without changes since `activityType` remains 'craftable'.

## Verification
- Toggle Alchemy off -> hero banner best action should not be an alchemy craftable
- Toggle Forging off -> hero banner best action should not be a forging craftable
- Both off -> no craftables in hero banner

## Acceptance Criteria

App.vue bestAction correctly respects alchemy/forging filter split; no compile errors; hero banner updates reactively when filters change


## Notes

**2026-03-04T16:28:28Z**

Phase 4 complete. Verified App.vue and all consumers work correctly with alchemy/forging split.

Verification:
- App.vue only uses getFilteredAndRerankedActivities() which was updated in Phase 2
- ProfitRankingTable.vue updated in Phase 3
- No other files consume the activity filters directly
- Hero banner bestAction automatically respects alchemy/forging filters via the singleton state

All 458 tests passing
No code changes needed for this phase - integration works correctly
