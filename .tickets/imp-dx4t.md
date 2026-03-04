---
id: imp-dx4t
status: closed
deps: []
links: [imp-jepe]
created: 2026-03-04T17:04:49Z
type: epic
priority: 2
assignee: Félix Laguna Teno
tags: [ui, data, refresh-script]
---
# Feature: Sales volume icons in activity tabs

Track weekly item volume from history_data and show tier icons in Crafting/Dungeon tabs. Ticket: imp-jepe


## Notes

**2026-03-04T17:08:01Z**

## Planning Complete — Scouter Analysis

### Codebase Analysis Summary

Analyzed all 8 affected files in detail. The data pipeline is well-understood:

**Data flow**: defaults.json -> useDataProvider.ts -> calculators -> table components

**Key findings from code analysis:**

1. **refresh-market-prices.ts** (line 215): Already calls getMarketHistory() which returns MarketHistoryResponse including history_data — but history_data is completely unused today. The marketData variable is available at the point where we need to extract volume.

2. **MarketHistoryResponse** (services.ts line 93): Already typed with history_data: MarketHistoryEntry[] where MarketHistoryEntry has { date, total_sold, average_price }. No type additions needed in services.ts.

3. **useDataProvider.ts** (line 110-135): loadCraftableRecipes() already merges lastSaleAt from defaults into localStorage-sourced data. The SAME pattern must be used for weeklySalesVolume, or craftableRecipes loaded from localStorage will lose their volume data.

4. **CraftableCalculator** (line 182): The .map() over craftableRecipes is where volume propagation occurs. Simple field copy.

5. **DungeonCalculator** (line 56): Drops resolve recipes by name via recipeMap. Volume comes from the Recipe object, which already has the field after Phase 2.

6. **CraftableTable.vue** (line 297): name-cell uses flex layout with gap. Volume icon slots naturally between name text and low-confidence badge.

7. **DungeonTable.vue** (line 248): name-cell is simpler (no flex). Volume icon added inline after name text.

### Phases Created: 6 task tickets (linear dependency chain)

Phase 1 (imp-drh9): Data collection in refresh script
Phase 2 (imp-65w6): Type updates to interfaces
Phase 3 (imp-eyq8): Volume tier classification utility (new file)
Phase 4 (imp-94gy): Propagate through calculators
Phase 5 (imp-04ou): Icon display in tables
Phase 6 (imp-lunq): Review, testing, visual QA

### Dependencies: Linear
imp-drh9 -> imp-65w6 -> imp-eyq8 -> imp-94gy -> imp-04ou -> imp-lunq

### Risks and Mitigations

1. **useDataProvider merge logic** (MEDIUM): CraftableRecipes stored in localStorage need weeklySalesVolume merged from defaults.json. If missed, users who have localStorage data will see no volume icons. Phase 6 explicitly calls this out with the exact code needed.

2. **Icon choice** (LOW): Spec mentions flame metaphor but exact icons are TBD. The implementer should pick Unicode or inline SVG icons consistent with existing badges (low-confidence uses Unicode emoji). Left flexible in Phase 3/5 tickets.

3. **Threshold tuning** (LOW): Volume tier thresholds (0/1-9/10-49/50-199/200+) are reasonable guesses. The config is a single object so thresholds are trivial to adjust after seeing real data.

4. **No extra API calls** (NONE): Verified that history_data is already in the MarketHistoryResponse. No rate limit impact.

### Ready for user approval.

**2026-03-04T17:13:37Z**

Phases 1-4 implementation complete (as requested).

Summary of files modified:

Phase 1 (imp-drh9):
- /home/felix/idle-mmo-profiter/scripts/refresh-market-prices.ts
  - Added weeklySalesVolume to DefaultItem interface
  - Created computeWeeklySalesVolume() helper function
  - Propagated volume to all items and craftableRecipes

Phase 2 (imp-65w6):
- /home/felix/idle-mmo-profiter/src/types/index.ts
  - Added weeklySalesVolume to Material, Craftable, Recipe, CraftableRecipe interfaces

Phase 3 (imp-eyq8):
- /home/felix/idle-mmo-profiter/src/utils/salesVolume.ts (NEW FILE)
  - Volume tier classification: dead, trickle, moderate, active, hot
  - Icons: ○ → △ → ▲ → ● → 🔥
  - Thresholds: 0, 1-9, 10-49, 50-199, 200+

Phase 4 (imp-94gy):
- /home/felix/idle-mmo-profiter/src/calculators/craftableCalculator.ts
  - Added weeklySalesVolume to CraftableProfitResult
  - Propagated from CraftableRecipe
- /home/felix/idle-mmo-profiter/src/calculators/dungeonCalculator.ts
  - Added weeklySalesVolume to DungeonDropResult
  - Added minDropVolume to DungeonProfitResult
  - Computed min volume across tradable drops

TypeScript compilation: All passing
Tests: Not run (phases 5-6 will add UI and tests)

Data flow established:
refresh script → defaults.json → types → calculators → (ready for UI in phase 5)

**2026-03-04T17:20:10Z**

Reviewer approved with minor findings: (1) missing weeklySalesVolume in craftable sync block, (2) unused color property in tier config, (3) duplicated CSS (follows existing pattern), (4) hardcoded colors (follows existing pattern), (5) no unit tests for salesVolume.ts, (6) fire emoji ignores CSS color

**2026-03-04T17:23:28Z**

User Review: Perfect - work approved
