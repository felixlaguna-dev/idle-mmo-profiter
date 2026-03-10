/**
 * Composable for managing minimum sales volume filter.
 *
 * Allows filtering activities by their weekly sales volume.
 * Activities with volume below the threshold are excluded.
 * Activities with undefined volume (resources) always pass through.
 *
 * Default threshold: 10 sales/week (matches 'moderate' tier in salesVolume.ts)
 * State persists to localStorage.
 *
 * NOTE: This is a TRUE SINGLETON - all calls share the same reactive state.
 */

import { computed, type Ref } from 'vue'
import { useStorage } from './useStorage'

export interface MinSalesFilterState {
  minSalesThreshold: number
}

export interface UseMinSalesFilterReturn {
  /** Minimum weekly sales volume threshold (reactive) */
  minSalesThreshold: Ref<number>
  /** Set the minimum sales threshold */
  setMinSalesThreshold: (value: number) => void
  /** Filter activities array based on sales volume */
  filterBySalesVolume: <T extends { weeklySalesVolume?: number }>(items: T[]) => T[]
}

// Module-level singleton: Create filter state once at module load time
// This ensures all components share the SAME reactive refs
const filterState = useStorage<MinSalesFilterState>('min-sales-filter', {
  minSalesThreshold: 10,
})

/**
 * Composable for managing minimum sales volume filter.
 *
 * @returns Object containing reactive threshold and filter function
 */
export function useMinSalesFilter(): UseMinSalesFilterReturn {
  // Threshold ref for easy binding
  const minSalesThreshold = computed({
    get: () => filterState.value.minSalesThreshold,
    set: (value: number) => {
      filterState.value.minSalesThreshold = value
    },
  })

  // Setter function
  const setMinSalesThreshold = (value: number) => {
    filterState.value.minSalesThreshold = value
  }

  /**
   * Filter activities based on sales volume.
   * - Items with undefined volume (resources) always pass through
   * - Items with volume below threshold are excluded
   * - Items with volume >= threshold pass through
   */
  const filterBySalesVolume = <T extends { weeklySalesVolume?: number }>(items: T[]): T[] => {
    const threshold = filterState.value.minSalesThreshold
    return items.filter((item) => {
      // Resources and items without volume data always pass through
      if (item.weeklySalesVolume === undefined) {
        return true
      }
      // Filter by threshold
      return item.weeklySalesVolume >= threshold
    })
  }

  return {
    minSalesThreshold,
    setMinSalesThreshold,
    filterBySalesVolume,
  }
}
