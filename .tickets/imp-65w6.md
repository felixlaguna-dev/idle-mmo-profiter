---
id: imp-65w6
status: closed
deps: [imp-drh9]
links: []
created: 2026-03-04T17:06:19Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-dx4t
---
# Phase 2: Type updates — add weeklySalesVolume to TypeScript interfaces

Add the weeklySalesVolume optional field to all relevant TypeScript interfaces so the data flows from defaults.json through the app.

## Changes to src/types/index.ts

### 1. Material interface (line ~3)
Add:
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number

### 2. Craftable interface (line ~16)
Add:
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number

### 3. Recipe interface (line ~38)
Add:
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number

### 4. CraftableRecipe interface (line ~75)
Add:
  /** Weekly sales volume (units sold in last 7 days) from market history */
  weeklySalesVolume?: number

## No changes needed to
- DungeonDrop / Dungeon — dungeon drops reference recipes by name; volume will be resolved via recipe lookup in the calculator
- Resource / ResourceGather — these don't have market history sales volume

## Affected file
- /home/felix/idle-mmo-profiter/src/types/index.ts

## Acceptance Criteria

- [ ] weeklySalesVolume?: number added to Material, Craftable, Recipe, CraftableRecipe interfaces
- [ ] JSDoc comments explain the field
- [ ] TypeScript compilation passes with no errors


## Notes

**2026-03-04T17:11:10Z**

Phase 2 implementation complete.

Changes made to src/types/index.ts:
1. Added weeklySalesVolume?: number to Material interface (line 13)
2. Added weeklySalesVolume?: number to Craftable interface (line 26)
3. Added weeklySalesVolume?: number to Recipe interface (line 56)
4. Added weeklySalesVolume?: number to CraftableRecipe interface (line 89)

All fields include JSDoc comment: 'Weekly sales volume (units sold in last 7 days) from market history'

TypeScript compilation passed (vue-tsc step completed successfully).
