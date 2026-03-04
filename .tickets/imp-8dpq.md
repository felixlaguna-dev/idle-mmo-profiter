---
id: imp-8dpq
status: closed
deps: []
links: []
created: 2026-03-04T16:16:09Z
type: epic
priority: 2
assignee: Félix Laguna Teno
---
# Feature: Split craftables exclusion into alchemy and forging

Currently the global ranking has a single 'Craftables' exclusion toggle. User wants to independently exclude alchemy craftables and forging craftables from the ranking.


## Notes

**2026-03-04T16:17:24Z**

## Scouter Analysis

### Current Architecture

The 'Craftables' exclusion toggle in the global ranking works through these layers:

1. **State**: `useActivityFilters.ts` stores `ActivityFilters` shape `{ dungeons: boolean, craftables: boolean, resources: boolean }` via `useStorage('active-filters', ...)` (persisted to `idlemmo:active-filters` in localStorage). This is a module-level singleton.

2. **Filtering**: `getFilteredActivities()` checks `activity.activityType === 'craftable'` and filters if `filters.value.craftables === false`. All craftables (alchemy + forging) are treated as one category.

3. **UI**: `ProfitRankingTable.vue` renders three toggle buttons (Dungeons, Craftables, Resources) in a tab-bar style filter row.

4. **Data flow to best action**: `App.vue` calls `getFilteredAndRerankedActivities(rankedActivities.value)` using the same singleton, so exclusion affects the hero banner's best action.

### Key Observation: skill field NOT in RankedActivity

`RankedActivity` (profitRanker.ts) does NOT carry the `skill` field. The `CraftableProfitResult` has `skill?: 'alchemy' | 'forging'` computed via `inferSkillFromMaterials()` or the `CraftableRecipe.skill` field. But when `profitRanker.ts` maps craftables to `RankedActivity`, only `activityType: 'craftable'` is set -- no alchemy/forging distinction is preserved.

### Affected Files

- `/home/felix/idle-mmo-profiter/src/types/index.ts` - ActivityType type (may need new values or keep as-is)
- `/home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts` - RankedActivity interface + rankAllActivities() must propagate skill
- `/home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts` - ActivityFilters interface, filter state, filtering logic, localStorage migration
- `/home/felix/idle-mmo-profiter/src/components/ProfitRankingTable.vue` - UI toggle buttons (split Craftables into Alchemy + Forging)
- `/home/felix/idle-mmo-profiter/src/components/charts/ProfitBarChart.vue` - Groups by activityType 'craftable'
- `/home/felix/idle-mmo-profiter/src/components/charts/RevenueBreakdown.vue` - Groups by activityType 'craftable'
- `/home/felix/idle-mmo-profiter/src/tests/composables/useActivityFilters.test.ts` - Test updates
- `/home/felix/idle-mmo-profiter/src/tests/calculators/profitRanker.test.ts` - Test updates

**2026-03-04T16:19:23Z**

## Planning Complete

### Design Decision: Minimal activityType change
The `ActivityType` union (`'dungeon' | 'craftable' | 'resource'`) is NOT changed. Instead, a new optional `skill?: 'alchemy' | 'forging'` field is added to `RankedActivity`. This preserves backward compatibility across the entire codebase -- charts, type badges, and all existing code that checks `activityType === 'craftable'` continues to work unchanged.

### Phases (5 tasks, linear dependency chain)
1. **imp-5zqf** - Add `skill` field to `RankedActivity`, propagate from profitRanker (data layer)
2. **imp-teer** - Split `ActivityFilters.craftables` into `alchemy` + `forging`, add localStorage migration (state layer)
3. **imp-tnxy** - Update ProfitRankingTable UI: two buttons instead of one (UI layer)
4. **imp-ixfr** - Verify App.vue bestAction and other consumers work correctly (integration)
5. **imp-nux7** - OPTIONAL: Split charts to show alchemy/forging separately (enhancement)

Dependencies: 1 -> 2 -> 3 -> 4 -> 5

### Risks
- **Mobile layout**: Adding a 4th filter button (Dungeons, Alchemy, Forging, Resources) may cause overflow on 375px screens. The existing CSS uses `flex: 0 0 auto` so buttons should shrink gracefully, but visual verification is needed.
- **localStorage migration**: Users with existing `craftables: true/false` preference need migration. The plan handles this with a one-time migration block.
- **Skill field undefined edge case**: If `RankedActivity.skill` is undefined for a craftable (shouldn't happen since `inferSkillFromMaterials` always returns a value, but defensively), the filter treats it as forging (the default).

### Scope boundary
- Charts (Phase 5) are optional and should be skipped unless explicitly requested
- The type badge in the ranking table continues to show 'craftable' for both alchemy and forging items
- Low-confidence filtering is unchanged -- it applies to all craftables regardless of skill

**2026-03-04T16:20:12Z**

User approved plan with all 5 phases including chart color split. Proceeding with implementation.

**2026-03-04T16:30:32Z**

Epic complete! All 5 phases implemented successfully.

## Summary of Changes

### Phase 1 - Data Layer (imp-5zqf)
Added skill field to RankedActivity interface and propagated from craftableResults in profitRanker.ts

### Phase 2 - State Layer (imp-teer)
Split ActivityFilters.craftables into alchemy + forging booleans with localStorage migration in useActivityFilters.ts

### Phase 3 - UI Layer (imp-tnxy)
Replaced single Craftables button with separate Alchemy and Forging buttons in ProfitRankingTable.vue

### Phase 4 - Integration (imp-ixfr)
Verified App.vue bestAction and all consumers work correctly with split filters (no changes needed)

### Phase 5 - Chart Colors (imp-nux7)
Updated ProfitBarChart and RevenueBreakdown to show alchemy (emerald) and forging (teal) as distinct categories

## Files Modified
1. /home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts
2. /home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts
3. /home/felix/idle-mmo-profiter/src/components/ProfitRankingTable.vue
4. /home/felix/idle-mmo-profiter/src/components/charts/ProfitBarChart.vue
5. /home/felix/idle-mmo-profiter/src/components/charts/RevenueBreakdown.vue
6. /home/felix/idle-mmo-profiter/src/tests/calculators/profitRanker.test.ts
7. /home/felix/idle-mmo-profiter/src/tests/composables/useActivityFilters.test.ts

## Test Results
All 458 tests passing

## Feature Complete
Users can now independently toggle alchemy and forging craftables in the global profit ranking. The filter state persists to localStorage and is migrated from the old craftables key. Charts also show the distinction with distinct colors.

**2026-03-04T16:31:00Z**

Implementation complete across all 5 phases. 458 tests passing. Invoking reviewer.

**2026-03-04T16:32:36Z**

## Code Review: APPROVED (with minor observations)

### Files Reviewed
1. `/home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts`
2. `/home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts`
3. `/home/felix/idle-mmo-profiter/src/components/ProfitRankingTable.vue`
4. `/home/felix/idle-mmo-profiter/src/components/charts/ProfitBarChart.vue`
5. `/home/felix/idle-mmo-profiter/src/components/charts/RevenueBreakdown.vue`
6. `/home/felix/idle-mmo-profiter/src/tests/calculators/profitRanker.test.ts`
7. `/home/felix/idle-mmo-profiter/src/tests/composables/useActivityFilters.test.ts`
8. `/home/felix/idle-mmo-profiter/src/App.vue` (verified consumers -- no changes needed)

### Results
- **Linter**: PASS (0 issues on all 7 modified files)
- **Tests**: PASS (458/458 passing, 31 test files)
- **Correctness**: All logic verified correct
- **Style Guide**: Consistent with existing codebase patterns

### Detailed Review

**Data Layer (profitRanker.ts)** -- Clean. The `skill` field addition to `RankedActivity` is minimal and well-placed. JSDoc comment present. Propagation from `craftable.skill` is correct.

**State Layer (useActivityFilters.ts)** -- Good. The filter split from `craftables` to `alchemy` + `forging` is clean. The two-step localStorage migration (potions -> craftables -> alchemy + forging) handles all legacy formats. The defensive handling of `undefined` skill (treated as forging) at line 116 is correct since `inferSkillFromMaterials` always returns a value but the field is typed as optional on `RankedActivity`.

**UI Layer (ProfitRankingTable.vue)** -- Template changes are correct. Accessibility attributes (aria-pressed, aria-label) are present on both new buttons.

**Chart Components (ProfitBarChart.vue, RevenueBreakdown.vue)** -- Emerald/teal color distinction is clear. Legend updated. Both components correctly split by `activity.skill`.

**Tests** -- Comprehensive. New tests cover:
- Skill propagation from craftables (4 tests)
- Independent alchemy/forging filter toggling
- Undefined skill treated as forging
- localStorage migration from craftables and from potions
- Low-confidence filter interaction with split filters

### Minor Observations (non-blocking)

1. **[Dead CSS] ProfitRankingTable.vue:482-491** -- The `.filter-button.active.badge-craftable` and `.filter-button.active.badge-craftable::before` CSS rules are now dead code. No filter button uses the `badge-craftable` class anymore (the toggle buttons now use `badge-alchemy` and `badge-forging`). The `.badge-craftable` class at line 704 is still used by the type badge in table rows, but the filter-button variants are orphaned.

2. **[Style] ProfitRankingTable.vue:493-513** -- The `badge-alchemy` and `badge-forging` CSS rules are identical (both use `#4ade80` green). While this is intentional (same green family for both crafting sub-types), it means the two filter buttons look identical when active. The chart components already use distinct colors (emerald vs teal). Consider whether the filter buttons should also have distinct colors for visual consistency.

3. **[Tests] useActivityFilters.test.ts:521-603** -- The migration tests duplicate the migration logic inline rather than importing/calling the actual migration code. This means the tests verify a copy of the migration logic, not the real migration. This is acceptable since the migration runs at module load time and is difficult to test in isolation, but it is worth noting.

4. **[Efficiency] useActivityFilters.ts:42-44** -- The write-back guard (`if (filters.alchemy !== undefined && filters.forging !== undefined)`) will be true for users who already have the new format, causing an unnecessary localStorage write on every page load. Consider checking whether migration actually occurred (e.g., with a `let migrated = false` flag).

### Verdict

The implementation is correct, well-tested, and consistent with existing patterns. The four observations above are all non-blocking and can be addressed at the maintainer's discretion. Ready for user review.

**2026-03-04T16:32:53Z**

Review: APPROVED. 0 linter issues, 458 tests pass. 4 non-blocking observations: orphaned CSS for badge-craftable, both filter buttons same green color, migration test duplication, unnecessary localStorage write on every load.

**2026-03-04T16:43:00Z**

User Review: Perfect - approved
