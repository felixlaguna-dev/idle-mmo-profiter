---
id: imp-teer
status: closed
deps: [imp-5zqf]
links: []
created: 2026-03-04T16:18:11Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-8dpq
---
# Phase 2: Split craftables filter state into alchemy and forging

## Summary
Replace the single `craftables: boolean` filter with two separate filters: `alchemy: boolean` and `forging: boolean`. Add localStorage migration for backward compatibility.

## Files to modify
- `/home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts`

## Implementation details

### 1. Update ActivityFilters interface
```typescript
export interface ActivityFilters {
  dungeons: boolean
  alchemy: boolean    // was: craftables: boolean
  forging: boolean    // new
  resources: boolean
}
```

### 2. Add migration for existing users
Add a one-time migration block (similar to the existing potions->craftables migration at line 20-33) that runs BEFORE the useStorage call:
- Read `idlemmo:active-filters` from localStorage
- If it has `craftables` but not `alchemy`/`forging`:
  - Set `alchemy = craftables` and `forging = craftables` (preserve user's existing preference)
  - Delete the old `craftables` key
  - Write back to `idlemmo:active-filters`
- The existing potions->craftables migration (lines 20-33) should be updated to also handle the full chain: potions -> craftables -> alchemy+forging

### 3. Update useStorage default
```typescript
const filters = useStorage<ActivityFilters>('active-filters', {
  dungeons: true,
  alchemy: true,
  forging: true,
  resources: true,
})
```

### 4. Replace filterCraftables computed with filterAlchemy + filterForging
- Remove `filterCraftables` computed property
- Add `filterAlchemy` computed (get/set on `filters.value.alchemy`)
- Add `filterForging` computed (get/set on `filters.value.forging`)

### 5. Update UseActivityFiltersReturn interface
```typescript
export interface UseActivityFiltersReturn {
  filterDungeons: Ref<boolean>
  filterAlchemy: Ref<boolean>
  filterForging: Ref<boolean>
  filterResources: Ref<boolean>
  getFilteredActivities: (activities: RankedActivity[]) => RankedActivity[]
  getFilteredAndRerankedActivities: (activities: RankedActivity[]) => RankedActivity[]
}
```

### 6. Update getFilteredActivities logic
Replace:
```typescript
if (activity.activityType === 'craftable' && !filters.value.craftables) return false
```
With:
```typescript
if (activity.activityType === 'craftable') {
  if (activity.skill === 'alchemy' && !filters.value.alchemy) return false
  if (activity.skill === 'forging' && !filters.value.forging) return false
  // If skill is undefined, treat as forging (the inferSkillFromMaterials default)
  if (!activity.skill && !filters.value.forging) return false
}
```

### 7. Update low-confidence filter for craftables
The existing low-confidence check for craftables should apply to BOTH alchemy and forging:
```typescript
if (activity.activityType === 'craftable' && activity.isLowConfidence) {
  return lowConfidenceFilter.showLowConfidenceCraftables.value
}
```
This stays the same -- the low-confidence toggle is orthogonal to alchemy/forging split.

## Tests to update
- `/home/felix/idle-mmo-profiter/src/tests/composables/useActivityFilters.test.ts`
  - Replace all `filterCraftables` references with `filterAlchemy` and `filterForging`
  - Add tests for:
    - Excluding only alchemy (forging still shown)
    - Excluding only forging (alchemy still shown)
    - Excluding both (no craftables shown)
    - Migration from old format

## Acceptance Criteria

ActivityFilters has alchemy+forging instead of craftables; migration preserves existing user preferences; filtering correctly distinguishes alchemy vs forging craftables; all existing filter tests updated and passing


## Notes

**2026-03-04T16:25:57Z**

Phase 2 complete. Split craftables filter state into alchemy and forging with localStorage migration.

Files modified:
- /home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts - Updated ActivityFilters interface, added migration logic, split filterCraftables into filterAlchemy + filterForging, updated filtering logic to distinguish alchemy vs forging based on skill field
- /home/felix/idle-mmo-profiter/src/tests/composables/useActivityFilters.test.ts - Updated all tests to use filterAlchemy and filterForging, added migration tests and skill handling tests

All useActivityFilters tests passing (11/11)
Note: ProfitRankingTable.vue still needs to be updated in Phase 3 to use the new filters
