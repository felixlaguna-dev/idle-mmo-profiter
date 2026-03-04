---
id: imp-04ou
status: closed
deps: [imp-94gy]
links: []
created: 2026-03-04T17:07:12Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-dx4t
---
# Phase 5: Display volume tier icons in CraftableTable and DungeonTable

Add volume tier icons next to item names in both activity tables, with tooltips showing the actual weekly volume.

## Changes to src/components/CraftableTable.vue

### 1. Import the volume utility
import { getVolumeTierInfo } from '../utils/salesVolume'

### 2. Add volume icon next to the craftable name in the name-cell (line ~297)
After the craftable name text and before the low-confidence badge:

<span
  v-if="craftable.weeklySalesVolume !== undefined"
  class="volume-badge"
  :class="'volume-' + getVolumeTierInfo(craftable.weeklySalesVolume).tier"
  :title="craftable.weeklySalesVolume + ' units sold this week (' + getVolumeTierInfo(craftable.weeklySalesVolume).label + ')'"
>{{ getVolumeTierInfo(craftable.weeklySalesVolume).icon }}</span>

### 3. Add CSS for volume badge
.volume-badge { ... } — small inline icon with tier-specific color
.volume-dead { opacity: 0.3; }
.volume-trickle { color: var(--text-secondary); }
.volume-moderate { color: var(--text-primary); }
.volume-active { color: #fbbf24; }  /* amber */
.volume-hot { color: #ef4444; }  /* red/orange */

## Changes to src/components/DungeonTable.vue

### 1. Import the volume utility
import { getVolumeTierInfo } from '../utils/salesVolume'

### 2. Add volume icon next to the dungeon name in the name-cell (line ~248)
Use dungeon.minDropVolume for the dungeon-level indicator:

<span
  v-if="dungeon.minDropVolume !== undefined"
  class="volume-badge"
  :class="'volume-' + getVolumeTierInfo(dungeon.minDropVolume).tier"
  :title="'Lowest drop volume: ' + dungeon.minDropVolume + ' units/week (' + getVolumeTierInfo(dungeon.minDropVolume).label + ')'"
>{{ getVolumeTierInfo(dungeon.minDropVolume).icon }}</span>

### 3. Add per-drop volume in expanded view (inside drop-table, line ~322)
Next to each drop name in the expanded breakdown, show individual drop volumes:

<span
  v-if="drop.weeklySalesVolume !== undefined"
  class="volume-badge small"
  :class="'volume-' + getVolumeTierInfo(drop.weeklySalesVolume).tier"
  :title="drop.weeklySalesVolume + ' units sold this week'"
>{{ getVolumeTierInfo(drop.weeklySalesVolume).icon }}</span>

### 4. Add CSS for volume badge (same as CraftableTable)

## Visual design notes
- The volume badge sits in the name-cell alongside the existing low-confidence badge
- It should be slightly smaller than the name text, visually subordinate
- Order: [Name] [volume-icon] [low-confidence-badge] [delete-button]
- On mobile, the icon should remain visible (it's small enough)
- The tooltip gives the exact number — the icon gives the at-a-glance tier

## Affected files
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue

## Acceptance Criteria

- [ ] Volume tier icon visible next to craftable names in CraftableTable
- [ ] Volume tier icon visible next to dungeon names in DungeonTable
- [ ] Per-drop volume icons in dungeon expanded view
- [ ] Tooltip shows exact volume count and tier name
- [ ] Icons have tier-specific colors (dead=dim, trickle=gray, moderate=default, active=amber, hot=red)
- [ ] Layout works on both desktop and mobile viewports
- [ ] Icons don't interfere with existing low-confidence badges or delete buttons


## Notes

**2026-03-04T17:14:31Z**

Starting implementation. Need to:
1. Add weeklySalesVolume merge in useDataProvider.ts (same pattern as lastSaleAt)
2. Add volume icons to CraftableTable.vue
3. Add volume icons to DungeonTable.vue

**2026-03-04T17:16:04Z**

Implementation complete:

1. Updated useDataProvider.ts to merge weeklySalesVolume from defaults (same pattern as lastSaleAt)
2. Added volume tier icons to CraftableTable.vue:
   - Icon next to craftable name
   - Tooltip shows exact volume and tier
   - CSS styling with tier-specific colors
3. Added volume tier icons to DungeonTable.vue:
   - Icon next to dungeon name using minDropVolume
   - Icon next to each drop in expanded view
   - Tooltip shows volume and tier
   - CSS styling matching CraftableTable

Files modified:
- /home/felix/idle-mmo-profiter/src/composables/useDataProvider.ts
- /home/felix/idle-mmo-profiter/src/components/CraftableTable.vue
- /home/felix/idle-mmo-profiter/src/components/DungeonTable.vue

TypeScript compilation passes (vue-tsc --noEmit).
