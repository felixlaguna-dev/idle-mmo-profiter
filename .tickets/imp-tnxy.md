---
id: imp-tnxy
status: closed
deps: [imp-teer]
links: []
created: 2026-03-04T16:18:31Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-8dpq
---
# Phase 3: Update ProfitRankingTable UI to show Alchemy and Forging toggle buttons

## Summary
Replace the single 'Craftables' toggle button with two separate buttons: 'Alchemy' and 'Forging', each with appropriate styling.

## Files to modify
- `/home/felix/idle-mmo-profiter/src/components/ProfitRankingTable.vue`

## Implementation details

### 1. Update imports from useActivityFilters
Replace:
```typescript
const { filterDungeons, filterCraftables, filterResources, getFilteredAndRerankedActivities } =
  useActivityFilters()
```
With:
```typescript
const { filterDungeons, filterAlchemy, filterForging, filterResources, getFilteredAndRerankedActivities } =
  useActivityFilters()
```

### 2. Replace the Craftables button in template
Replace the single Craftables button (lines 162-170) with two buttons:
```html
<button
  class="filter-button"
  :class="{ active: filterAlchemy, 'badge-alchemy': filterAlchemy }"
  :aria-pressed="filterAlchemy"
  aria-label="Toggle alchemy activities"
  @click="filterAlchemy = !filterAlchemy"
>
  Alchemy
</button>
<button
  class="filter-button"
  :class="{ active: filterForging, 'badge-forging': filterForging }"
  :aria-pressed="filterForging"
  aria-label="Toggle forging activities"
  @click="filterForging = !filterForging"
>
  Forging
</button>
```

### 3. Add CSS for new badge styles
Add styles for `badge-alchemy` and `badge-forging`. Both currently share the craftable green (`#4ade80` / `rgba(34, 197, 94, ...)`).

Recommended approach: Keep both as the same green since they are sub-categories of 'craftable'. The distinction comes from the label text. This avoids needing to change the chart colors and type-badge system.

Alternative: Use two distinct shades (e.g., alchemy = emerald green, forging = amber/orange). This would also require updating ProfitBarChart and RevenueBreakdown.

NOTE: The implementer should use the same green for both unless the user has expressed a preference for distinct colors. This keeps the scope minimal.

```css
.filter-button.active.badge-alchemy {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background-color: rgba(34, 197, 94, 0.1);
}

.filter-button.active.badge-alchemy::before {
  width: 100%;
  background-color: #4ade80;
}

.filter-button.active.badge-forging {
  color: #4ade80;
  border-bottom-color: #4ade80;
  background-color: rgba(34, 197, 94, 0.1);
}

.filter-button.active.badge-forging::before {
  width: 100%;
  background-color: #4ade80;
}
```

### 4. Mobile responsive check
Verify the filter bar does not overflow on mobile (375px). With 4 buttons instead of 3, the tab bar might get tight. The existing CSS uses `flex: 0 0 auto` so it should wrap or scroll. Verify visually.

## No test changes needed
ProfitRankingTable.vue does not have dedicated unit tests for the filter buttons. The logic is tested via useActivityFilters tests (Phase 2).

## Acceptance Criteria

Two separate toggle buttons (Alchemy, Forging) replace the single Craftables button; buttons toggle independently; styling is consistent with existing filter bar design; no overflow on mobile


## Notes

**2026-03-04T16:27:32Z**

Phase 3 complete. Replaced single Craftables button with separate Alchemy and Forging buttons.

Files modified:
- /home/felix/idle-mmo-profiter/src/components/ProfitRankingTable.vue - Updated imports, replaced single Craftables button with Alchemy + Forging buttons, added badge-alchemy and badge-forging CSS styles (both use same green color as craftables for consistency)

UI now shows 4 filter buttons: Dungeons, Alchemy, Forging, Resources
All 457 tests passing (1 pre-existing failure in priceConfidence test)
