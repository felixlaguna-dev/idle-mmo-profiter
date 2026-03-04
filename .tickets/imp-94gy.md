---
id: imp-94gy
status: closed
deps: [imp-eyq8]
links: []
created: 2026-03-04T17:06:54Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-dx4t
---
# Phase 4: Propagate weeklySalesVolume through calculators

Pass weeklySalesVolume through the craftable and dungeon calculators so it reaches the table components.

## Changes to src/calculators/craftableCalculator.ts

### 1. Add to CraftableProfitResult interface (line ~93)
  /** Weekly sales volume of the finished product */
  weeklySalesVolume?: number

### 2. In calculateCraftableProfits(), propagate from CraftableRecipe to result
In the .map() callback (line ~182), after constructing the result object:
  result.weeklySalesVolume = craftable.weeklySalesVolume

The volume comes from the CraftableRecipe, which is populated from defaults.json by the refresh script.

## Changes to src/calculators/dungeonCalculator.ts

### 1. Add to DungeonDropResult interface (line ~4)
  /** Weekly sales volume of this drop's recipe */
  weeklySalesVolume?: number

### 2. Add to DungeonProfitResult interface (line ~14)
  /** Minimum weekly sales volume among tradable drops (indicates overall dungeon liquidity) */
  minDropVolume?: number

### 3. In calculateDungeonProfits(), propagate volume from Recipe to DungeonDropResult
In the .map() callback for drops (line ~56), add:
  weeklySalesVolume: recipe.weeklySalesVolume

### 4. Compute dungeon-level volume metric
After computing dropResults, calculate the minimum volume among tradable drops:
  const tradableDropVolumes = dropResults
    .filter(d => { const r = recipeMap.get(d.recipeName); return r && !r.isUntradable })
    .map(d => d.weeklySalesVolume ?? 0)
  const minDropVolume = tradableDropVolumes.length > 0 ? Math.min(...tradableDropVolumes) : 0

Add minDropVolume to the DungeonProfitResult object.

Rationale for using min: A dungeon's liquidity is limited by its least-traded drop. If one drop has 0 volume, the expected profit from that drop is unreliable.

## No changes needed to
- useDataProvider.ts — weeklySalesVolume is already on the interfaces and flows through defaults.json automatically
- useProfitRanking.ts — the calculators are called the same way, just with more data on the input interfaces

## Affected files
- /home/felix/idle-mmo-profiter/src/calculators/craftableCalculator.ts
- /home/felix/idle-mmo-profiter/src/calculators/dungeonCalculator.ts

## Acceptance Criteria

- [ ] CraftableProfitResult has weeklySalesVolume field
- [ ] DungeonDropResult has weeklySalesVolume field
- [ ] DungeonProfitResult has minDropVolume field
- [ ] weeklySalesVolume propagates from CraftableRecipe -> CraftableProfitResult
- [ ] weeklySalesVolume propagates from Recipe -> DungeonDropResult
- [ ] minDropVolume computed as min of tradable drops' volumes
- [ ] TypeScript compilation passes


## Notes

**2026-03-04T17:13:24Z**

Phase 4 implementation complete.

Changes to src/calculators/craftableCalculator.ts:
1. Added weeklySalesVolume?: number to CraftableProfitResult interface (line 115)
2. Propagated weeklySalesVolume from craftable to result (line 264)

Changes to src/calculators/dungeonCalculator.ts:
1. Added weeklySalesVolume?: number to DungeonDropResult interface (line 11)
2. Added minDropVolume?: number to DungeonProfitResult interface (line 22)
3. Propagated weeklySalesVolume from Recipe to DungeonDropResult (line 82)
4. Computed minDropVolume as minimum of tradable drops' volumes (lines 107-116)
   - Filters for tradable recipes only (excludes untradable)
   - Takes min of all volumes (0 if drop has no volume data)
   - Returns 0 if no tradable drops

Rationale for minDropVolume: A dungeon's liquidity is limited by its least-traded drop. If one drop has low volume, the expected profit from that drop is less reliable.

TypeScript compilation passes.
