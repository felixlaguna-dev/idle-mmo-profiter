import { computed, type Ref } from 'vue'
import { useStorage } from './useStorage'
import { useLowConfidenceFilter } from './useLowConfidenceFilter'
import type { RankedActivity } from '../calculators/profitRanker'

export interface ActivityFilters {
  dungeons: boolean
  alchemy: boolean
  forging: boolean
  resources: boolean
}

export interface UseActivityFiltersReturn {
  filterDungeons: Ref<boolean>
  filterAlchemy: Ref<boolean>
  filterForging: Ref<boolean>
  filterResources: Ref<boolean>
  getFilteredActivities: (activities: RankedActivity[]) => RankedActivity[]
  getFilteredAndRerankedActivities: (activities: RankedActivity[]) => RankedActivity[]
}

// One-time migration: potions -> craftables -> alchemy + forging
try {
  const stored = localStorage.getItem('active-filters')
  if (stored) {
    const filters = JSON.parse(stored)

    // Step 1: Migrate potions -> craftables (legacy)
    if (filters.potions !== undefined && filters.craftables === undefined) {
      filters.craftables = filters.potions
      delete filters.potions
    }

    // Step 2: Migrate craftables -> alchemy + forging
    if (filters.craftables !== undefined && (filters.alchemy === undefined || filters.forging === undefined)) {
      filters.alchemy = filters.craftables
      filters.forging = filters.craftables
      delete filters.craftables
    }

    // Write back if any migration occurred
    if (filters.alchemy !== undefined && filters.forging !== undefined) {
      localStorage.setItem('active-filters', JSON.stringify(filters))
    }
  }
} catch (error) {
  console.error('Failed to migrate active-filters:', error)
}

// Module-level singleton: Create filter state once at module load time
// This ensures all components share the SAME reactive refs
const filters = useStorage<ActivityFilters>('active-filters', {
  dungeons: true,
  alchemy: true,
  forging: true,
  resources: true,
})

// Access low-confidence filter state (also a singleton) at module level
// for the filtering functions
const lowConfidenceFilter = useLowConfidenceFilter()

/**
 * Composable for managing activity type filters.
 * Persists filter state to localStorage and provides filtering logic.
 *
 * NOTE: This is a TRUE SINGLETON - all calls share the same reactive filter state.
 * This ensures that filter changes in one component (e.g., ProfitRankingTable)
 * immediately trigger reactivity in other components (e.g., App.vue's bestAction).
 */
export function useActivityFilters(): UseActivityFiltersReturn {
  // Individual filter refs for easy binding
  const filterDungeons = computed({
    get: () => filters.value.dungeons,
    set: (value: boolean) => {
      filters.value.dungeons = value
    },
  })

  const filterAlchemy = computed({
    get: () => filters.value.alchemy,
    set: (value: boolean) => {
      filters.value.alchemy = value
    },
  })

  const filterForging = computed({
    get: () => filters.value.forging,
    set: (value: boolean) => {
      filters.value.forging = value
    },
  })

  const filterResources = computed({
    get: () => filters.value.resources,
    set: (value: boolean) => {
      filters.value.resources = value
    },
  })

  /**
   * Filter activities based on current filter state.
   * Also respects low-confidence toggles for dungeons and craftables.
   * Preserves original rank numbers.
   */
  const getFilteredActivities = (activities: RankedActivity[]): RankedActivity[] => {
    return activities.filter((activity) => {
      // Filter by activity type
      if (activity.activityType === 'dungeon' && !filters.value.dungeons) return false

      // Filter craftables by skill (alchemy vs forging)
      if (activity.activityType === 'craftable') {
        if (activity.skill === 'alchemy' && !filters.value.alchemy) return false
        if (activity.skill === 'forging' && !filters.value.forging) return false
        // If skill is undefined, treat as forging (the inferSkillFromMaterials default)
        if (!activity.skill && !filters.value.forging) return false
      }

      if (activity.activityType === 'resource' && !filters.value.resources) return false

      // Filter by low-confidence status using the composable's state
      // This delegates to the centralized low-confidence filter logic
      if (activity.activityType === 'dungeon' && activity.isLowConfidence) {
        return lowConfidenceFilter.showLowConfidenceDungeons.value
      }
      if (activity.activityType === 'craftable' && activity.isLowConfidence) {
        return lowConfidenceFilter.showLowConfidenceCraftables.value
      }

      return true
    })
  }

  /**
   * Filter activities and re-rank them starting from 1.
   * Updates the rank property to reflect filtered position.
   */
  const getFilteredAndRerankedActivities = (activities: RankedActivity[]): RankedActivity[] => {
    const filtered = getFilteredActivities(activities)

    // Re-rank filtered activities
    return filtered.map((activity, index) => ({
      ...activity,
      rank: index + 1,
    }))
  }

  return {
    filterDungeons,
    filterAlchemy,
    filterForging,
    filterResources,
    getFilteredActivities,
    getFilteredAndRerankedActivities,
  }
}
