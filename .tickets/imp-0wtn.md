---
id: imp-0wtn
status: closed
deps: []
links: []
created: 2026-03-02T11:20:32Z
type: epic
priority: 2
assignee: Félix Laguna Teno
tags: [feature, profit-calculation]
---
# Feature: Low-Confidence Price Toggle

Exclude items without 30-day sales and dungeons from profit calculations by default. Add toggles on crafting and dungeons pages to enable inclusion of these low-confidence prices.


## Notes

**2026-03-02T11:22:30Z**

## Scouter Analysis Complete

### Affected Files

**Core Calculators:**
- `/home/felix/idle-mmo-profiter/src/calculators/dungeonCalculator.ts` - Dungeon profit calculation
- `/home/felix/idle-mmo-profiter/src/calculators/craftableCalculator.ts` - Craftable profit calculation
- `/home/felix/idle-mmo-profiter/src/calculators/profitRanker.ts` - Ranks all activities

**Tables (UI Components):**
- `/home/felix/idle-mmo-profiter/src/components/DungeonTable.vue` - Dungeons tab
- `/home/felix/idle-mmo-profiter/src/components/CraftableTable.vue` - Craftables tab

**Composables:**
- `/home/felix/idle-mmo-profiter/src/composables/useProfitRanking.ts` - Reactive profit ranking
- `/home/felix/idle-mmo-profiter/src/composables/useActivityFilters.ts` - Existing filter pattern (singleton)
- `/home/felix/idle-mmo-profiter/src/composables/useDataProvider.ts` - Data layer

**Types:**
- `/home/felix/idle-mmo-profiter/src/types/index.ts` - Core type definitions

### Key Findings

1. **No 30-day sales data exists yet** - The types have `lastUpdated` and `suggestedRefreshMinutes` but no sales count/period field

2. **Dungeons exclusion** - Currently ALL dungeons are included. Need to add a flag to exclude by default.

3. **Existing filter pattern** - `useActivityFilters.ts` provides a good singleton pattern for filter state management

4. **Table components** receive pre-calculated data as props, filtering would happen at the App.vue level or in the tables themselves

### Implementation Approach Options

**Option A: Per-Page Toggle**
- Toggle on each table (DungeonTable, CraftableTable)
- State local to each component (or shared via composable)
- Clean separation

**Option B: Global Setting**
- Single toggle in settings panel
- Affects all pages
- Consistent behavior

### Questions for User

- UI/UX for toggle (switch vs checkbox)
- Toggle state persistence
- Toggle label/wording
- Visual distinction for low-confidence items

**2026-03-02T11:23:02Z**

## Clarifying Questions for User

Before proceeding with implementation plan, please clarify:

### 1. Data Source for 30-Day Sales
[x] Where does the 30-day sales data come from?
[x] Is this an existing API field we need to add to the data model?
[x] Should we add `hasSalesLast30Days: boolean` field to Material/Craftable/Recipe types?

### 2. Dungeon Exclusion Scope
[x] You said 'Dungeons should be excluded from profit calculation by default'
[x] Does this mean ALL dungeons by default, or only dungeons whose drops have low-confidence prices?
[x] Should this be a separate toggle or combined with the low-confidence toggle?

### 3. Toggle UI/UX
[ ] Should the toggle be a switch, checkbox, or button?
[ ] Where should it be placed? (Above table, in toolbar, floating?)
[ ] Should toggle state persist across page reloads? (localStorage)

### 4. Visual Distinction
[ ] When low-confidence items ARE shown (toggle enabled), should they have:
    - Different row color/background?
    - Warning icon or badge?
    - Tooltip explaining why?

### 5. Toggle Label Wording
[ ] Preferred label text:
    - 'Include low-confidence prices' ?
    - 'Show items without 30-day sales' ?
    - Something else?

### 6. Per-Page or Global?
[ ] Should each page (crafting, dungeons) have its OWN toggle?
[ ] Or one global toggle in settings that affects all pages?

**2026-03-02T11:30:25Z**

## Research Complete - Implementation Approach

### Data Flow Understanding

1. **API returns `latest_sold[]`** with `sold_at` timestamps for each transaction
2. **Low-confidence detection**: Check if any `sold_at` is within last 30 days
3. **Current filtering pattern**: `useActivityFilters.ts` uses singleton with `useStorage` for localStorage persistence

### Implementation Strategy

**Phase 1: Types & Data Layer**
- Add `lastSaleAt?: string` field to Material, Craftable, Recipe types
- Add low-confidence detection utility function
- Update data provider to expose low-confidence status

**Phase 2: Toggle State Composable**
- Create `useLowConfidenceFilter.ts` composable (singleton pattern like useActivityFilters)
- Separate toggles for crafting and dungeons pages
- Persist to localStorage

**Phase 3: Filtering Logic**
- Update profit calculators to mark low-confidence results
- Add filtering in tables based on toggle state

**Phase 4: UI Components**
- Add toggle switches to CraftableTable and DungeonTable
- Add warning badge/icon for low-confidence items when shown
- Visual styling for the badge

### Files to Modify

- `src/types/index.ts` - Add lastSaleAt field
- `src/utils/priceConfidence.ts` - NEW: Low-confidence detection utility
- `src/composables/useLowConfidenceFilter.ts` - NEW: Toggle state management
- `src/calculators/craftableCalculator.ts` - Add isLowConfidence to results
- `src/calculators/dungeonCalculator.ts` - Add isLowConfidence to results
- `src/components/CraftableTable.vue` - Add toggle + warning badges
- `src/components/DungeonTable.vue` - Add toggle + warning badges

**2026-03-02T11:31:54Z**

## Implementation Plan Ready for Approval

### Summary

5 task tickets created with clear dependencies:

```
imp-xvsq (Phase 1: Types & Utility)
    │
    ├── imp-a75y (Phase 2: Composable)
    │       │
    │       ├── imp-uht6 (Phase 4: CraftableTable UI)
    │       │
    │       └── imp-ggvo (Phase 5: DungeonTable UI)
    │
    └── imp-xx26 (Phase 3: Calculators)
            │
            ├── imp-uht6 (Phase 4: CraftableTable UI)
            │
            └── imp-ggvo (Phase 5: DungeonTable UI)
```

### Task Details

**Phase 1 (imp-xvsq): Types & Low-Confidence Detection Utility**
- Add `lastSaleAt?: string` to Material, Craftable, Recipe types
- Create `src/utils/priceConfidence.ts` with `isLowConfidencePrice()` function
- Unit tests included

**Phase 2 (imp-a75y): Low-Confidence Filter Composable**
- Create `src/composables/useLowConfidenceFilter.ts`
- Singleton pattern with localStorage persistence
- Two toggles: `showLowConfidenceCraftables`, `showLowConfidenceDungeons`
- Both default to `false` (exclude by default)

**Phase 3 (imp-xx26): Update Calculators**
- Add `isLowConfidence?: boolean` to result interfaces
- Mark craftables without recent sales as low-confidence
- Mark dungeons with low-confidence drops as low-confidence
- Unit tests included

**Phase 4 (imp-uht6): CraftableTable UI**
- Add toggle switch above table (label: 'Include low-confidence prices')
- Filter list based on toggle state
- Add warning badge/icon to low-confidence items when shown
- Yellow/amber color scheme

**Phase 5 (imp-ggvo): DungeonTable UI**
- Same pattern as Phase 4 for DungeonTable
- Warning badges on dungeon rows and individual drops in expanded view

### Estimated Scope
- ~4-6 files to modify
- ~2 new files to create
- Unit tests for each phase
- No database migrations needed (uses existing API data)

### Ready for User Approval
All clarifications resolved:
- [x] Data source: `latest_sold[].sold_at` from API
- [x] Dungeon scope: Only low-confidence dungeons excluded
- [x] Toggle UI: Switch with localStorage persistence
- [x] Visual: Warning badge/icon when shown

**2026-03-02T11:52:21Z**

Implementation complete.

## Files Created:
- src/utils/priceConfidence.ts - Low-confidence detection utility
- src/composables/useLowConfidenceFilter.ts - Toggle state composable  
- src/tests/utils/priceConfidence.test.ts - 13 tests
- src/tests/composables/useLowConfidenceFilter.test.ts - 11 tests

## Files Modified:
- src/types/index.ts - Added lastSaleAt field to Material, Craftable, Recipe, CraftableRecipe
- src/calculators/craftableCalculator.ts - Added isLowConfidence to results
- src/calculators/dungeonCalculator.ts - Added isLowConfidence to dungeon and drop results
- src/tests/calculators/craftableCalculator.test.ts - Added 4 low-confidence tests
- src/tests/calculators/dungeonCalculator.test.ts - Added 5 low-confidence tests
- src/components/CraftableTable.vue - Toggle, filtering, warning badges
- src/components/DungeonTable.vue - Toggle, filtering, warning badges

## Test Results:
- All 422 tests passing
- TypeScript type check passing

## Features:
1. Items/dungeons with no sales in 30+ days marked as low-confidence
2. Toggle switches on both Crafting and Dungeons tabs
3. Low-confidence items excluded by default
4. Warning badges (⚠) on affected items when shown
5. State persisted to localStorage

**2026-03-02T11:55:30Z**

## Code Review: APPROVED

### Files Reviewed
**New Files:**
- /home/felix/idle-mmo-profiter/src/utils/priceConfidence.ts
- /home/felix/idle-mmo-profiter/src/composables/useLowConfidenceFilter.ts
- /home/felix/idle-mmo-profiter/src/tests/utils/priceConfidence.test.ts
- /home/felix/idle-mmo-profiter/src/tests/composables/useLowConfidenceFilter.test.ts

**Modified Files:**
- /home/felix/idle-mmo-profiter/src/types/index.ts
- /home/felix/idle-mmo-profiter/src/calculators/craftableCalculator.ts
- /home/felix/idle-mmo-profiter/src/calculators/dungeonCalculator.ts
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue
- /home/felix/idle-mmo-profiter/src/tests/calculators/craftableCalculator.test.ts
- /home/felix/idle-mmo-profiter/src/tests/calculators/dungeonCalculator.test.ts

### Checks

**Linter:** PASS (no errors)

**TypeScript:** PASS (vue-tsc --noEmit completed without errors)

**Tests:** All 422 tests passing
- priceConfidence.test.ts: 13 tests
- useLowConfidenceFilter.test.ts: 11 tests
- craftableCalculator.test.ts: 15 tests (4 new low-confidence tests)
- dungeonCalculator.test.ts: 18 tests (5 new low-confidence tests)

### Code Quality Assessment

**1. Code Quality:** GOOD
- Clean, readable code following existing patterns
- Proper use of TypeScript types
- Good separation of concerns (utility, composable, calculator, component)

**2. Tests:** EXCELLENT
- Comprehensive test coverage for all new functionality
- Edge cases well tested (empty data, boundary conditions at 30 days, missing fields)
- Tests for singleton behavior in composable
- Tests for persistence to localStorage

**3. Types:** GOOD
- Proper type definitions with JSDoc comments
- Optional lastSaleAt field correctly typed as string | undefined
- isLowConfidence correctly typed as optional boolean in result interfaces

**4. Edge Cases:** WELL HANDLED
- Empty sales data (latestSold.length === 0) returns true
- Missing lastSaleAt field returns true (low confidence)
- Exactly 30 days boundary is NOT low confidence (correct: >30, not >=30)
- Missing recipe in dungeon drops marked as low-confidence

**5. Performance:** GOOD
- No performance concerns
- Simple date arithmetic and array filtering
- Singleton pattern prevents duplicate state

**6. Consistency:** EXCELLENT
- CraftableTable and DungeonTable implementations are consistent
- Same toggle UI pattern, same badge styling
- Both use the same 30-day threshold
- Both default to excluding low-confidence items

**7. Security:** NO CONCERNS
- No XSS vulnerabilities (no user input rendered as HTML)
- No injection concerns (pure data processing)
- localStorage access is safe (uses existing useStorage composable)

### Minor Observations (Non-Blocking)

1. **Code Duplication:** The isLowConfidence function is duplicated in both craftableCalculator.ts and dungeonCalculator.ts. This could be refactored to use the shared priceConfidence.ts utility, but since the calculators should remain independent and the function is small (~10 lines), this is acceptable.

2. **Unused Function:** getLowConfidenceReason in priceConfidence.ts is exported but not currently used in the UI. This could be useful for future tooltips showing WHY an item is low-confidence. Not a problem - it is available for future use.

### Summary
The implementation is solid, well-tested, and follows project conventions. The feature correctly identifies items without recent sales data and provides a clean UI toggle for users to show/hide these items. The default behavior (exclude low-confidence items) matches the feature requirements.

**2026-03-02T12:00:49Z**

User Review: Minor Issues - (1) All dungeons marked as low confidence, may need price refresh, (2) Toggle checkbox looks bad visually, (3) Reminder: app runs on Docker, not npm run dev

**2026-03-02T12:06:17Z**

Visual QA Findings: (1) CRITICAL: Toggle checkbox is unstyled HTML checkbox, needs design system styling, (2) CRITICAL: All items marked as low-confidence - lastSaleAt field may not be populated from data source, (3) MAJOR: Mobile toggle label may need shortening

**2026-03-02T12:09:20Z**

## Iteration 1 Planning Complete

### Visual QA Findings Analysis

**CRITICAL Issues:**
1. **Data Issue**: All items marked as low-confidence because `lastSaleAt` is never populated
   - Root cause: `useMarketRefresh.ts` fetches `latest_sold[]` from API but never extracts/stores `sold_at` as `lastSaleAt`
   - The calculators check `craftable.lastSaleAt` and `recipe.lastSaleAt` which are always undefined

2. **Toggle Styling**: Basic unstyled HTML checkbox
   - Current: `<input type="checkbox">` with only `accent-color: var(--warning)`
   - Needs: Styled switch component matching design system

**MAJOR Issue:**
3. **Mobile Label**: May be too long on small screens
   - Current: "Show low-confidence (X)"
   - Needs optimization for 375px viewport

### Iteration Tasks Created

```
imp-w9i6 [Iteration 1: Fix lastSaleAt data population]
    │
    ├── imp-7z4f [Iteration 2: Style toggle as design-system switch]
    │
    └── imp-6vm0 [Iteration 3: Optimize mobile toggle label]
```

### Task Details

**imp-w9i6 - Fix lastSaleAt data population**
- Modify `useMarketRefresh.ts` to extract `sold_at` from `latest_sold[]`
- Add `updateLastSaleAt` method to `useDataProvider.ts`
- After this fix, items with recent sales will NOT be marked low-confidence

**imp-7z4f - Style toggle as design-system switch**
- Replace basic checkbox with styled toggle switch
- Use --warning color (amber) when enabled
- Smooth transitions, accessible keyboard navigation
- Apply to both CraftableTable.vue and DungeonTable.vue

**imp-6vm0 - Optimize mobile toggle label**
- Shorten or reflow label on mobile viewports
- Ensure it fits at 375px width without wrapping

### Files Affected

- `src/composables/useMarketRefresh.ts` - Extract lastSaleAt from API
- `src/composables/useDataProvider.ts` - Store lastSaleAt
- `src/components/CraftableTable.vue` - Toggle styling, mobile label
- `src/components/DungeonTable.vue` - Toggle styling, mobile label

### Ready for Approval

**2026-03-02T12:18:15Z**

Iteration fixes complete.

## Files Modified:
- /home/felix/idle-mmo-profiter/src/composables/useMarketRefresh.ts - Extract lastSaleAt from latest_sold[] API response
- /home/felix/idle-mmo-profiter/src/composables/useDataProvider.ts - Added updateLastSaleAt() method for materials, craftables, recipes
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue - Styled toggle switch, responsive label
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue - Styled toggle switch, responsive label

## Changes:
1. lastSaleAt now populated from market history API when refreshing prices
2. Toggle replaced with styled switch (amber warning color when enabled)
3. Mobile label shortened from 'Show low-confidence' to 'Low-conf.'

## Tests: All 422 passing

**2026-03-02T12:21:37Z**

## Code Review: APPROVED

### Files Reviewed

**Modified Files (Iteration):**
- /home/felix/idle-mmo-profiter/src/composables/useMarketRefresh.ts
- /home/felix/idle-mmo-profiter/src/composables/useDataProvider.ts
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue

### Checklist Results

**1. Code Quality:** PASS
- Clean, readable code following existing patterns
- Proper use of TypeScript types with JSDoc comments
- Good separation of concerns between composables and components

**2. Tests:** PASS
- All 422 tests passing
- Linter: PASS (no errors)
- TypeScript: PASS (vue-tsc --noEmit completed without errors)

**3. Toggle Styling:** PASS
- Styled switch component using design system tokens:
  - Uses --warning color (amber) when enabled
  - Uses --bg-tertiary and --border-color for slider
  - Uses --text-secondary for knob
  - Uses --ease-out for transitions
  - Proper focus state with outline
- Mobile responsive: smaller dimensions on 767px breakpoint
- Shortened label ("Low-conf.") on mobile

**4. Data Logic:** PASS
- lastSaleAt correctly extracted from marketHistory.latest_sold[0].sold_at
- updateLastSaleAt method added to useDataProvider for materials, craftables, recipes
- Resource category not updated (not needed for low-confidence detection)

**5. Accessibility:** PASS
- aria-label="Show low-confidence items" on checkbox
- Focus state with outline: 2px solid var(--accent-primary), offset 2px
- Toggle is keyboard accessible (checkbox input)
- Warning badge has cursor: help and title tooltip

### Code Quality Assessment

**Data Flow:**
```
API (latest_sold[0].sold_at)
  -> useMarketRefresh.ts extracts lastSaleAt
  -> useDataProvider.updateLastSaleAt() persists to localStorage
  -> Calculators use isLowConfidence(lastSaleAt) 
  -> Tables filter via useLowConfidenceFilter composable
```

**Toggle Implementation:**
- Custom CSS toggle switch (not native checkbox)
- Hidden native checkbox for accessibility and keyboard navigation
- Smooth 0.3s transitions using --ease-out
- Warning color scheme (amber #f59e0b) when enabled
- Mobile-optimized with shorter label

**Potential Minor Issues (Non-blocking):**

1. **Missing resource category**: The updateLastSaleAt function does not accept 'resources' as a category. This is intentional since resources use marketPrice, not lastSaleAt. The type signature correctly excludes 'resources'. Not a bug.

2. **No transition group**: The table row filtering uses computed properties without transition animations. This is acceptable as adding transitions to table rows can be complex and may not provide significant UX benefit.

### Summary

The iteration changes are well-implemented and address the Visual QA findings from the previous iteration:

1. **lastSaleAt data population**: Fixed - now correctly extracted from API response and persisted via dataProvider
2. **Toggle styling**: Fixed - now uses a styled switch matching the design system
3. **Mobile label**: Fixed - shortened to "Low-conf." on mobile viewports

The code follows project conventions, passes all tests, and is ready for user review.

**2026-03-02T13:16:27Z**

User Review: All craftables still showing as low-confidence. Need to check if lastSaleAt is being populated on data refresh/repopulate.

**2026-03-02T16:34:22Z**

User Review: Issue with Death's Touch - profit is high but recipe hasn't been sold in over a month. Need to investigate low-confidence calculation logic for craftables.

**2026-03-02T16:45:32Z**

User Review: (1) Sorting should only consider low-confidence when toggle is enabled, (2) Veinseeker Recipe marked as low-confidence but may have wrong lastSaleAt data

**2026-03-02T16:49:14Z**

## Iteration 2 Analysis

### User Feedback Issues

**Issue 1: Sorting should only consider low-confidence when toggle is enabled**
- Current behavior: Sorting happens BEFORE filtering
- Problem: Low-confidence items affect sort order even when hidden
- Fix: Move sorting AFTER filtering, or sort low-confidence items to bottom

**Issue 2: Recipe low-confidence logic too aggressive**
- Current: isCraftableLowConfidence checks BOTH craftable AND recipe
- Problem: Death's Touch has high profit but marked low-confidence because recipe hasn't sold
- Fix: Only check recipe low-confidence when calculating 'with recipe cost' profit, not for base craftable

**Issue 3: Veinseeker Recipe wrong lastSaleAt**
- Possible data issue where recipe lastSaleAt is stale or incorrect
- Need to verify recipe data refresh is working correctly

### Proposed Changes

1. **Sort Order Change**: Low-confidence items should sort to bottom regardless of toggle state
2. **Low-Confidence Logic Change**: A craftable is only low-confidence if the CRAFTED ITEM has no recent sales. The recipe's sales history should NOT affect this.
3. **Recipe Profit Confidence**: Show a separate warning on the 'with recipe cost' profit line if the recipe is low-confidence

**2026-03-02T16:50:06Z**

## Iteration 2 Planning Complete

### Tasks Created

```
imp-01uy [Iteration 2: Fix sorting - low-confidence items to bottom]
    │
    └── imp-y20e [Iteration 3: Fix low-confidence logic]
            │
            └── imp-i0nn [Iteration 4: Add recipe confidence indicator]
```

### Task Details

**imp-01uy - Fix sorting (low-confidence items to bottom)**
- Modify sorting in CraftableTable.vue and DungeonTable.vue
- Low-confidence items always sort to bottom, regardless of toggle state
- When toggle is OFF: items filtered (current behavior)
- When toggle is ON: items show but at bottom of list
- Implementation: Add secondary sort key for isLowConfidence

**imp-y20e - Fix low-confidence logic**
- Modify isCraftableLowConfidence in craftableCalculator.ts
- Only check the CRAFTED ITEM's lastSaleAt
- Do NOT check the recipe's lastSaleAt
- Recipe confidence tracked separately (for UI display)
- Same for dungeonCalculator.ts if applicable

**imp-i0nn - Add recipe confidence indicator**
- Add isRecipeLowConfidence to CraftableProfitResult
- Show warning icon on 'with recipe cost' line when recipe is low-confidence
- Tooltip explains recipe price may be stale
- Does NOT affect filtering/sorting of craftables

### Files to Modify

- src/calculators/craftableCalculator.ts - Fix isCraftableLowConfidence, add isRecipeLowConfidence
- src/calculators/dungeonCalculator.ts - Same fixes if applicable
- src/components/CraftableTable.vue - Sorting logic, recipe confidence display
- src/components/DungeonTable.vue - Sorting logic
- src/tests/calculators/craftableCalculator.test.ts - Update tests

### Ready for User Approval

**2026-03-02T17:20:52Z**

Implementation complete.

## Files modified:
- /home/felix/idle-mmo-profiter/src/calculators/craftableCalculator.ts - Fixed isCraftableLowConfidence to only check crafted item's lastSaleAt, Added isRecipeLowConfidence
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue - Sorting fix (low-confidence to bottom), recipe confidence badge
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue - Sorting fix (low-confidence to bottom)
- /home/felix/idle-mmo-profiter/src/tests/calculators/craftableCalculator.test.ts - Updated tests for new low-confidence logic

## Tests: All 422 passing
## Feature changes:
1. Sorting: Low-confidence items always sort to bottom ( regardless of toggle state
2. Low-confidence logic: Only checks craftable item's lastSaleAt (not recipe's)
3. Recipe confidence: New isRecipeLowConfidence field shows warning badge next to recipe price when shown

**2026-03-02T17:21:13Z**

Iteration 2 Implementation Complete.

## Summary of Changes:

### Sorting Fix (imp-01uy)
- Low-confidence items now always sort to bottom in both CraftableTable and DungeonTable
- Sorting happens BEFORE filtering
- Works regardless of toggle state (when toggle is OFF, items are filtered)
- When toggle is ON, items show at bottom with warning badge

### Low-Confidence Logic Fix (imp-y20e)
- isLowConfidence now only checks the CRAFTED ITEM's lastSaleAt
- The recipe's lastSaleAt is tracked separately in isRecipeLowConfidence
- This allows showing a warning badge specifically on the recipe price in the UI
- Recipe low-confidence does NOT affect the craftable's filtering/sorting
### Recipe Confidence Indicator (imp-i0nn)
- Added isRecipeLowConfidence field to CraftableProfitResult interface
- Added warning badge next to recipe market price in the expanded view
- Added CSS styling for the badge
### Dungeon Toggle & Badges (imp-ggvo)
- Already implemented in previous iteration
- Sorting fix applied to match CraftableTable
## Tests:
- All 422 tests passing
- Updated tests for new low-confidence logic

**2026-03-02T17:43:43Z**

User Clarification: Craftable is low-confidence if (1) craftable itself has no recent sales, OR (2) recipe has no recent sales, OR (3) any component/material has no recent sales. Need to check entire crafting chain.

**2026-03-02T19:50:18Z**

User Review: Broken - need to investigate what's not working

**2026-03-02T20:43:34Z**

User Review: PERFECT - Work approved. All low-confidence logic working correctly. Market data refreshed for recipes and craftableRecipes.

**2026-03-02T22:44:55Z**

Fix: All tab ranking now respects low-confidence toggles. Vendor-sold materials excluded from confidence check.
