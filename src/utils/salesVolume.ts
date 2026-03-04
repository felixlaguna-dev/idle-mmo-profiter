/**
 * Sales volume tier classification utility
 *
 * Classifies weekly sales volume into tiers with associated icons and tooltips.
 * Used to display market activity/liquidity indicators in the Crafting and Dungeon tabs.
 */

export type VolumeTier = 'dead' | 'trickle' | 'moderate' | 'active' | 'hot'

export interface VolumeTierConfig {
  min: number
  max: number
  label: string
  icon: string
  tooltip: string
  color?: string
}

/**
 * Volume tier configuration with thresholds, icons, and styling
 *
 * Tiers (units sold per week):
 * - Dead: 0 units (no market activity)
 * - Trickle: 1-9 units (minimal activity)
 * - Moderate: 10-49 units (normal activity)
 * - Active: 50-199 units (strong activity)
 * - Hot: 200+ units (very high activity)
 */
export const VOLUME_TIER_CONFIG: Record<VolumeTier, VolumeTierConfig> = {
  dead: {
    min: 0,
    max: 0,
    label: 'Dead',
    icon: '○',
    tooltip: 'No sales this week',
    color: 'var(--text-dim, #6b7280)',
  },
  trickle: {
    min: 1,
    max: 9,
    label: 'Trickle',
    icon: '△',
    tooltip: '1-9 units sold this week',
    color: 'var(--text-secondary, #9ca3af)',
  },
  moderate: {
    min: 10,
    max: 49,
    label: 'Moderate',
    icon: '▲',
    tooltip: '10-49 units sold this week',
    color: 'var(--text-primary, #e5e7eb)',
  },
  active: {
    min: 50,
    max: 199,
    label: 'Active',
    icon: '●',
    tooltip: '50-199 units sold this week',
    color: '#fbbf24', // amber
  },
  hot: {
    min: 200,
    max: Infinity,
    label: 'Hot',
    icon: '🔥',
    tooltip: '200+ units sold this week',
    color: '#f97316', // orange
  },
}

/**
 * Classify weekly sales volume into a tier
 *
 * @param weeklySalesVolume - Number of units sold in the last 7 days
 * @returns The volume tier classification
 */
export function getVolumeTier(weeklySalesVolume?: number): VolumeTier {
  if (weeklySalesVolume === undefined || weeklySalesVolume === 0) return 'dead'
  if (weeklySalesVolume < 10) return 'trickle'
  if (weeklySalesVolume < 50) return 'moderate'
  if (weeklySalesVolume < 200) return 'active'
  return 'hot'
}

/**
 * Get complete tier information for a given weekly sales volume
 *
 * @param weeklySalesVolume - Number of units sold in the last 7 days
 * @returns Tier classification with config and actual volume
 */
export function getVolumeTierInfo(weeklySalesVolume?: number) {
  const tier = getVolumeTier(weeklySalesVolume)
  const config = VOLUME_TIER_CONFIG[tier]
  const volume = weeklySalesVolume ?? 0

  return {
    tier,
    ...config,
    volume,
    // Tooltip with actual volume count
    tooltip: volume > 0 ? `${volume} units sold this week (${config.label})` : config.tooltip,
  }
}
