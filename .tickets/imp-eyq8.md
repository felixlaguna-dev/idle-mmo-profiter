---
id: imp-eyq8
status: closed
deps: [imp-65w6]
links: []
created: 2026-03-04T17:06:38Z
type: task
priority: 2
assignee: Félix Laguna Teno
parent: imp-dx4t
---
# Phase 3: Volume tier classification utility — src/utils/salesVolume.ts

Create a new utility file that classifies weekly sales volume into named tiers with associated icons and tooltips.

## New file: src/utils/salesVolume.ts

### 1. Define VolumeTier type
export type VolumeTier = 'dead' | 'trickle' | 'moderate' | 'active' | 'hot'

### 2. Define tier thresholds in a config object
export const VOLUME_TIER_CONFIG: Record<VolumeTier, { min: number; max: number; label: string; icon: string; tooltip: string }> = {
  dead:     { min: 0,   max: 0,   label: 'Dead',     icon: '---', tooltip: 'No sales this week' },
  trickle:  { min: 1,   max: 9,   label: 'Trickle',  icon: '---', tooltip: '1-9 units sold this week' },
  moderate: { min: 10,  max: 49,  label: 'Moderate', icon: '---', tooltip: '10-49 units sold this week' },
  active:   { min: 50,  max: 199, label: 'Active',   icon: '---', tooltip: '50-199 units sold this week' },
  hot:      { min: 200, max: Infinity, label: 'Hot',  icon: '---', tooltip: '200+ units sold this week' },
}

NOTE: Icons are TBD — placeholder '---' above. The spec mentions flame metaphor (single flame to fire). Options:
- Unicode characters (accessible, no dependencies)
- Inline SVG icons (consistent sizing)
- The implementer should choose icons that match the app's existing visual style

### 3. Classification function
export function getVolumeTier(weeklySalesVolume?: number): VolumeTier {
  if (weeklySalesVolume === undefined || weeklySalesVolume === 0) return 'dead'
  if (weeklySalesVolume < 10) return 'trickle'
  if (weeklySalesVolume < 50) return 'moderate'
  if (weeklySalesVolume < 200) return 'active'
  return 'hot'
}

### 4. Helper to get tier info
export function getVolumeTierInfo(weeklySalesVolume?: number) {
  const tier = getVolumeTier(weeklySalesVolume)
  return {
    tier,
    ...VOLUME_TIER_CONFIG[tier],
    volume: weeklySalesVolume ?? 0,
  }
}

### 5. CSS color mapping (optional export)
Each tier should have a distinct visual treatment. Suggested approach:
- dead: dim/muted gray
- trickle: light gray or faded
- moderate: neutral/default text color
- active: warm color (amber)
- hot: strong warm color (orange-red)

## Design considerations
- Keep thresholds in a single config object so they are easy to tune
- The function must handle undefined gracefully (items with no volume data = 'dead')
- This complements but does NOT replace the existing low-confidence system
- Tooltip should always include the actual volume number: "X units sold this week (Tier)"

## Affected file
- /home/felix/idle-mmo-profiter/src/utils/salesVolume.ts (NEW)

## Acceptance Criteria

- [ ] New file src/utils/salesVolume.ts exists
- [ ] VolumeTier type exported
- [ ] VOLUME_TIER_CONFIG exported with all 5 tiers
- [ ] getVolumeTier() correctly classifies: 0->dead, 5->trickle, 25->moderate, 100->active, 500->hot
- [ ] getVolumeTierInfo() returns complete tier info including volume count
- [ ] Handles undefined input gracefully (returns dead tier)


## Notes

**2026-03-04T17:12:01Z**

Phase 3 implementation complete.

Created new file src/utils/salesVolume.ts with:
1. VolumeTier type: 'dead' | 'trickle' | 'moderate' | 'active' | 'hot'
2. VolumeTierConfig interface with min, max, label, icon, tooltip, color
3. VOLUME_TIER_CONFIG object with all 5 tiers:
   - dead: 0 units (○, gray)
   - trickle: 1-9 units (△, light gray)
   - moderate: 10-49 units (▲, white)
   - active: 50-199 units (●, amber)
   - hot: 200+ units (🔥, orange)
4. getVolumeTier() function - classifies volume to tier
5. getVolumeTierInfo() function - returns complete tier info including dynamic tooltip

Icons chosen: Unicode characters consistent with existing app style (like ⚠ for warnings).
Flame metaphor: ○ → △ → ▲ → ● → 🔥 (increasing intensity)

TypeScript compilation passes.
