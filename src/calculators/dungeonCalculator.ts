import type { Dungeon, MagicFindSettings, Recipe } from '../types'
import { isLowConfidence } from '../utils/priceConfidence'

export interface DungeonDropResult {
  recipeName: string
  price: number
  chance: number
  expectedValue: number
  /** True if this drop's price is low-confidence */
  isLowConfidence?: boolean
  /** Weekly sales volume of this drop's recipe */
  weeklySalesVolume?: number
}

export interface DungeonProfitResult {
  name: string
  runCost: number
  timeSeconds: number
  drops: DungeonDropResult[]
  totalProfit: number
  profitPerHour: number
  /** True if ANY drop has a low-confidence price */
  isLowConfidence?: boolean
  /** Minimum weekly sales volume among tradable drops (indicates overall dungeon liquidity) */
  minDropVolume?: number
}

/**
 * Calculates profit for all dungeons based on Magic Find settings.
 *
 * Formula for each drop:
 * - expected_value = recipe_price * chance * (1 + totalMF/100)
 * - totalMF = mfStreak + mfDung + mfItem + mfBonus
 *
 * Dungeon profit:
 * - profit = SUM(expected_values) - run_cost
 * - profit_per_hour = profit / (time_seconds / 3600)
 *
 * @param dungeons - Array of dungeons with their drops
 * @param recipes - Array of all recipes with prices and chances
 * @param magicFind - Magic Find settings (streak, dungeon, item, bonus)
 * @returns Array of dungeon profit results sorted by profit per hour descending
 */
export function calculateDungeonProfits(
  dungeons: Dungeon[],
  recipes: Recipe[],
  magicFind: MagicFindSettings
): DungeonProfitResult[] {
  // Calculate total Magic Find percentage
  const totalMF = magicFind.streak + magicFind.dungeon + magicFind.item + magicFind.bonus

  // Create a map of recipe names to recipe data for quick lookup
  const recipeMap = new Map<string, Recipe>()
  recipes.forEach((recipe) => {
    recipeMap.set(recipe.name, recipe)
  })

  const results: DungeonProfitResult[] = dungeons.map((dungeon) => {
    // Calculate expected value for each drop
    const dropResults: DungeonDropResult[] = dungeon.drops.map((drop) => {
      const recipe = recipeMap.get(drop.recipeName)

      if (!recipe) {
        // Recipe not found - return zero values, mark as low-confidence
        return {
          recipeName: drop.recipeName,
          price: 0,
          chance: 0,
          expectedValue: 0,
          isLowConfidence: true,
          weeklySalesVolume: undefined,
        }
      }

      // Formula: expected_value = price * chance * (1 + totalMF/100)
      const expectedValue = recipe.price * recipe.chance * (1 + totalMF / 100)
      // Untradable recipes don't affect confidence - they can't be traded
      const dropIsLowConfidence = recipe.isUntradable ? false : isLowConfidence(recipe.lastSaleAt)

      return {
        recipeName: drop.recipeName,
        price: recipe.price,
        chance: recipe.chance,
        expectedValue,
        isLowConfidence: dropIsLowConfidence,
        weeklySalesVolume: recipe.weeklySalesVolume,
      }
    })

    // Sum all drop expected values
    const totalExpectedValue = dropResults.reduce((sum, drop) => sum + drop.expectedValue, 0)

    // Calculate profit
    const totalProfit = totalExpectedValue - dungeon.runCost

    // Calculate profit per hour
    const profitPerHour = totalProfit / (dungeon.timeSeconds / 3600)

    // Dungeon is low-confidence only if any TRADABLE drop is low-confidence
    // (untradable recipes don't count - they can't be traded so no market price)
    // Missing recipes still count as low-confidence
    const dungeonIsLowConfidence = dropResults.some((drop) => {
      const recipe = recipeMap.get(drop.recipeName)
      // Missing recipe = low-confidence
      if (!recipe) return drop.isLowConfidence
      // Untradable = doesn't affect confidence
      if (recipe.isUntradable) return false
      // Tradable = use drop's confidence flag
      return drop.isLowConfidence
    })

    // Compute minimum weekly sales volume among tradable drops
    // This indicates overall dungeon liquidity - limited by the least-traded drop
    const tradableDropVolumes = dropResults
      .filter((drop) => {
        const recipe = recipeMap.get(drop.recipeName)
        return recipe && !recipe.isUntradable
      })
      .map((drop) => drop.weeklySalesVolume ?? 0)

    const minDropVolume = tradableDropVolumes.length > 0 ? Math.min(...tradableDropVolumes) : 0

    return {
      name: dungeon.name,
      runCost: dungeon.runCost,
      timeSeconds: dungeon.timeSeconds,
      drops: dropResults,
      totalProfit,
      profitPerHour,
      isLowConfidence: dungeonIsLowConfidence,
      minDropVolume,
    }
  })

  // Sort by profit per hour descending
  return results.sort((a, b) => b.profitPerHour - a.profitPerHour)
}
