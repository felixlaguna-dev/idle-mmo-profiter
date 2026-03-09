/**
 * Item Uses Composable
 *
 * Provides reverse-lookup indexes to find all uses of an item across the game:
 * - Which craftable recipes use it as a material
 * - Which resource recipes use it as a material
 * - Which dungeons drop it
 * - Where it can be gathered
 * - What item it produces (if it's a recipe)
 *
 * This helps answer questions like "Why is Trout so expensive?" by revealing
 * all the demand sources for an item.
 */

import { computed } from 'vue'
import { useDataProvider } from './useDataProvider'
import type { CraftableRecipe, ResourceRecipe, Dungeon, ResourceGather } from '../types'

export interface ItemUse {
  type:
    | 'craftable-material'
    | 'resource-material'
    | 'dungeon-drop'
    | 'gathering-source'
    | 'recipe-product'
  context: string // e.g., 'Radiant Crest (alchemy)' or 'Millstone Mines'
  detail: string // e.g., '500x needed' or 'Cooking: Trout -> Cooked Trout'
  profitPerHour?: number // If available, to show profitability context
}

export interface ItemUsesResult {
  itemName: string
  uses: ItemUse[]
  totalDemandSources: number
}

// Singleton instance
let itemUsesInstance: ReturnType<typeof createItemUses> | null = null

/**
 * Create the item uses instance
 */
function createItemUses() {
  const dataProvider = useDataProvider()

  /**
   * Reverse-lookup: material name -> craftable recipes that use it
   */
  const materialToCraftables = computed(() => {
    const map = new Map<string, CraftableRecipe[]>()

    for (const recipe of dataProvider.craftableRecipes.value) {
      // Guard against missing materials array
      if (!recipe?.materials || !Array.isArray(recipe.materials)) {
        continue
      }

      for (const material of recipe.materials) {
        // Guard against invalid material structure
        if (!material?.name) {
          continue
        }

        const existing = map.get(material.name) || []
        existing.push(recipe)
        map.set(material.name, existing)
      }
    }

    return map
  })

  /**
   * Reverse-lookup: material name -> resource recipes that use it
   */
  const materialToResourceRecipes = computed(() => {
    const map = new Map<string, ResourceRecipe[]>()

    for (const recipe of dataProvider.resourceRecipes.value) {
      // Guard against missing materials array
      if (!recipe?.materials || !Array.isArray(recipe.materials)) {
        continue
      }

      for (const material of recipe.materials) {
        // Guard against invalid material structure
        if (!material?.name) {
          continue
        }

        const existing = map.get(material.name) || []
        existing.push(recipe)
        map.set(material.name, existing)
      }
    }

    return map
  })

  /**
   * Reverse-lookup: recipe name -> dungeons that drop it
   */
  const recipeNameToDungeons = computed(() => {
    const map = new Map<string, Dungeon[]>()

    for (const dungeon of dataProvider.dungeons.value) {
      for (const drop of dungeon.drops) {
        const existing = map.get(drop.recipeName) || []
        existing.push(dungeon)
        map.set(drop.recipeName, existing)
      }
    }

    return map
  })

  /**
   * Reverse-lookup: item name -> gathering source
   */
  const itemToGatheringSource = computed(() => {
    const map = new Map<string, ResourceGather>()

    for (const gather of dataProvider.resourceGathering.value) {
      map.set(gather.name, gather)
    }

    return map
  })

  /**
   * Reverse-lookup: recipe name -> produced item name
   */
  const recipeToProduct = computed(() => {
    const map = new Map<string, string>()

    for (const recipe of dataProvider.recipes.value) {
      if (recipe.producesItemName) {
        map.set(recipe.name, recipe.producesItemName)
      }
    }

    return map
  })

  /**
   * Get all uses for an item
   */
  function getItemUses(itemName: string): ItemUsesResult {
    const uses: ItemUse[] = []

    // 1. Check if this item is used as a material in craftable recipes
    const craftableRecipes = materialToCraftables.value.get(itemName) || []
    for (const recipe of craftableRecipes) {
      const material = recipe.materials.find((m) => m.name === itemName)
      const quantityText = material ? `${material.quantity}x needed` : ''
      const skillText = recipe.skill ? ` (${recipe.skill})` : ''

      uses.push({
        type: 'craftable-material',
        context: `${recipe.name}${skillText}`,
        detail: quantityText,
        // profitPerHour will be added by the UI component if available
      })
    }

    // 2. Check if this item is used as a material in resource recipes
    const resourceRecipes = materialToResourceRecipes.value.get(itemName) || []
    for (const recipe of resourceRecipes) {
      const material = recipe.materials.find((m) => m.name === itemName)
      const quantityText = material ? `${material.quantity}x needed` : ''

      uses.push({
        type: 'resource-material',
        context: `${recipe.name} (${recipe.skill})`,
        detail: quantityText,
      })
    }

    // 3. Check if this item is a recipe dropped by dungeons
    const dungeons = recipeNameToDungeons.value.get(itemName) || []
    for (const dungeon of dungeons) {
      const drop = dungeon.drops.find((d) => d.recipeName === itemName)
      const dropChance = drop
        ? `${((drop.expectedValue / (dungeon.numDrops * 100)) * 100).toFixed(1)}% drop rate`
        : ''

      uses.push({
        type: 'dungeon-drop',
        context: dungeon.name,
        detail: dropChance,
      })
    }

    // 4. Check if this item has a gathering source
    const gatheringSource = itemToGatheringSource.value.get(itemName)
    if (gatheringSource) {
      const timeText = `${gatheringSource.timeSeconds}s`
      const skillText = gatheringSource.skill ? `${gatheringSource.skill}` : 'gathering'

      uses.push({
        type: 'gathering-source',
        context: `${skillText.charAt(0).toUpperCase() + skillText.slice(1)}`,
        detail: timeText,
      })
    }

    // 5. Check if this is a recipe that produces an item
    const producedItem = recipeToProduct.value.get(itemName)
    if (producedItem) {
      uses.push({
        type: 'recipe-product',
        context: 'Recipe produces',
        detail: producedItem,
      })
    }

    return {
      itemName,
      uses,
      totalDemandSources: uses.length,
    }
  }

  return {
    // Indexes (for advanced use if needed)
    materialToCraftables,
    materialToResourceRecipes,
    recipeNameToDungeons,
    itemToGatheringSource,
    recipeToProduct,

    // Main API
    getItemUses,
  }
}

/**
 * Use item uses functionality (singleton pattern)
 */
export function useItemUses() {
  if (!itemUsesInstance) {
    itemUsesInstance = createItemUses()
  }
  return itemUsesInstance
}
