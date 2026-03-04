import { ref, computed, watch, type Ref } from 'vue'
import { useStorage } from './useStorage'
import { useDataProvider } from './useDataProvider'
import type { MagicFindSettings } from '../types'

/**
 * MF-only dungeons that don't appear in profit tables
 * but count towards Magic Find bonus
 */
const MF_ONLY_DUNGEONS = [
  'Silverleaf Enclave',
  'Stone Hollow',
  'Pumpkin Hollow',
  'Wickedroot Patch',
  'Winter Wonderland',
  'Snowbound Forest',
] as const

/**
 * Storage key for completed dungeons list
 */
const COMPLETED_DUNGEONS_KEY = 'completedDungeons'

/**
 * Load completed dungeons from localStorage
 */
function loadCompletedDungeons(): Set<string> {
  try {
    const stored = localStorage.getItem(`idlemmo:${COMPLETED_DUNGEONS_KEY}`)
    if (!stored) {
      return new Set<string>()
    }
    const array = JSON.parse(stored) as string[]
    return new Set(array)
  } catch (error) {
    console.error('Failed to load completed dungeons:', error)
    return new Set<string>()
  }
}

/**
 * Save completed dungeons to localStorage
 */
function saveCompletedDungeons(dungeons: Set<string>): void {
  try {
    const array = Array.from(dungeons)
    localStorage.setItem(`idlemmo:${COMPLETED_DUNGEONS_KEY}`, JSON.stringify(array))
  } catch (error) {
    console.error('Failed to save completed dungeons:', error)
  }
}

// Module-level singleton state
const completedDungeonsSet = ref<Set<string>>(loadCompletedDungeons())

// Access the existing magicFind storage at module level
const magicFind = useStorage<MagicFindSettings>('magicFind', {
  streak: 10,
  dungeon: 13,
  item: 3,
  bonus: 10,
})

// Access data provider at module level
const dataProvider = useDataProvider()

// Watch for changes to completedDungeons and save to localStorage
watch(
  completedDungeonsSet,
  (newSet) => {
    saveCompletedDungeons(newSet)
    // Also write back to magicFind.dungeon for profit calculator
    // Use object spread to ensure reactivity triggers for computed properties
    magicFind.value = { ...magicFind.value, dungeon: newSet.size }
  },
  { deep: true }
)

/**
 * Composable for managing Magic Find configuration.
 * Persists state to localStorage and provides computed totals.
 *
 * NOTE: This is a TRUE SINGLETON - all calls share the same reactive state.
 */
export function useMagicFindConfig() {
  /**
   * Completed dungeons set (reactive)
   */
  const completedDungeons: Ref<Set<string>> = completedDungeonsSet

  /**
   * All selectable dungeons (profit dungeons + MF-only dungeons)
   * Sorted alphabetically
   */
  const allSelectableDungeons = computed(() => {
    const profitDungeonNames = dataProvider.dungeons.value.map((d) => d.name)
    const allNames = [...profitDungeonNames, ...MF_ONLY_DUNGEONS]
    return allNames.sort()
  })

  /**
   * Magic Find from completed dungeons
   * Each completed dungeon = +1 MF
   */
  const dungeonMF = computed(() => completedDungeons.value.size)

  /**
   * Total Magic Find (sum of all 4 components)
   */
  const totalMF = computed(
    () => magicFind.value.streak + dungeonMF.value + magicFind.value.item + magicFind.value.bonus
  )

  /**
   * Toggle a dungeon's completion status
   * @param name - Dungeon name
   */
  function toggleDungeon(name: string): void {
    // Create a new Set to trigger reactivity
    const newSet = new Set(completedDungeons.value)

    if (newSet.has(name)) {
      newSet.delete(name)
    } else {
      newSet.add(name)
    }

    // Replace the entire Set to ensure Vue's reactivity system detects the change
    completedDungeons.value = newSet
  }

  /**
   * Check if a dungeon is completed
   * @param name - Dungeon name
   */
  function isDungeonCompleted(name: string): boolean {
    return completedDungeons.value.has(name)
  }

  /**
   * Clear all completed dungeons
   */
  function clearCompletedDungeons(): void {
    completedDungeons.value = new Set()
  }

  /**
   * Reset all state (for testing)
   * @internal
   */
  function _resetForTesting(): void {
    completedDungeons.value = new Set()
    magicFind.value = {
      streak: 10,
      dungeon: 0,
      item: 3,
      bonus: 10,
    }
  }

  return {
    // Constants
    MF_ONLY_DUNGEONS,

    // Reactive state
    completedDungeons,
    allSelectableDungeons,
    dungeonMF,
    totalMF,
    magicFind,

    // Methods
    toggleDungeon,
    isDungeonCompleted,
    clearCompletedDungeons,

    // Testing only
    _resetForTesting,
  }
}
