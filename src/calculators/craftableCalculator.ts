import type { CraftableRecipe, Recipe, CraftableMaterial } from '../types'
import { isLowConfidence } from '../utils/priceConfidence'

export interface CraftableMaterialResult {
  name: string
  quantity: number
  unitCost: number // Resolved from material price map
  totalCost: number
}

/**
 * Check if a craftable is low-confidence based on the entire crafting chain's sales.
 * A craftable is low-confidence if ANY of the following lack recent sales (>30 days):
 * 1. The craftable itself (its lastSaleAt)
 * 2. Its tradable recipe (if exists, its lastSaleAt)
 * 3. ANY of its materials/components (their lastSaleAt) - only if materialLastSaleAts is provided
 *    NOTE: Vendor-sold materials (with vendorValue > 0) are excluded from this check
 *
 * @param craftableLastSaleAt - The last sale timestamp of the crafted item
 * @param recipeLastSaleAt - The last sale timestamp of the tradable recipe (if any)
 * @param materialLastSaleAts - Array of last sale timestamps for each material. If not provided, materials are not checked.
 * @param materialVendorValues - Array of vendor values for each material. Materials with vendorValue > 0 are excluded from confidence check.
 */
function isCraftableLowConfidence(
  craftableLastSaleAt?: string,
  recipeLastSaleAt?: string,
  materialLastSaleAts?: (string | undefined)[],
  materialVendorValues?: (number | undefined)[]
): boolean {
  // Check the craftable itself
  if (isLowConfidence(craftableLastSaleAt)) {
    return true
  }

  // Check the tradable recipe (if provided)
  if (recipeLastSaleAt !== undefined && isLowConfidence(recipeLastSaleAt)) {
    return true
  }

  // Check all materials only if the array is provided (backwards compatibility)
  // Skip materials that have a vendor value (they have fixed prices, no market data needed)
  if (materialLastSaleAts !== undefined) {
    for (let i = 0; i < materialLastSaleAts.length; i++) {
      const materialLastSaleAt = materialLastSaleAts[i]
      const materialVendorValue = materialVendorValues?.[i]

      // Skip vendor-sold materials - they have fixed prices, no market data
      if (materialVendorValue && materialVendorValue > 0) {
        continue
      }

      if (isLowConfidence(materialLastSaleAt)) {
        return true
      }
    }
  }

  return false
}

/**
 * Check if a recipe's price is low-confidence.
 * A recipe is low-confidence if it has no sales within 30 days.
 * This is shown separately in the UI and does NOT affect the craftable's filtering.
 *
 * @param recipeLastSaleAt - The last sale timestamp of the recipe
 */
function isRecipeLowConfidence(recipeLastSaleAt?: string): boolean {
  return isLowConfidence(recipeLastSaleAt)
}

/**
 * Infer crafting skill from material names using a heuristic.
 *
 * Game crafting recipes use vendor-sold containers:
 * - Alchemy: Cheap Vial, Tarnished Vial, Gleaming Vial, Cheap Crystal, Tarnished Crystal, Gleaming Crystal, etc.
 * - Forging: Everything else (no Vial or Crystal ingredients)
 *
 * @param materials - Array of craftable materials
 * @returns 'alchemy' if any material ends with 'Vial' or 'Crystal', 'forging' otherwise
 */
function inferSkillFromMaterials(materials: CraftableMaterial[]): 'alchemy' | 'forging' {
  for (const material of materials) {
    if (material.name.endsWith('Vial') || material.name.endsWith('Crystal')) {
      return 'alchemy'
    }
  }
  return 'forging'
}

export interface CraftableProfitResult {
  name: string
  craftTimeSeconds: number
  materials: CraftableMaterialResult[]
  totalCost: number
  minSellPrice: number
  currentPrice: number
  profit: number
  profitPerHour: number
  hasRecipeCost: boolean
  profitWithRecipeCost?: number
  profitPerHourWithRecipeCost?: number
  recipeCostPerCraft?: number
  recipeUses?: number
  tradableRecipePrice?: number
  tradableRecipeName?: string
  skill?: 'alchemy' | 'forging'
  /** True if the craftable's price is low-confidence (no recent sales) */
  isLowConfidence?: boolean
  /** True if the tradable recipe's price is low-confidence (shown as warning on recipe cost line) */
  isRecipeLowConfidence?: boolean
}

/**
 * Calculates profit for all craftable recipes based on material costs and market prices.
 *
 * Formula:
 * - total_cost = SUM(mat_qty * mat_price)
 * - min_sell_price = total_cost + (total_cost * taxRate)
 * - profit = current_price - min_sell_price
 * - profit_per_hour = profit / (craft_time / 3600)
 *
 * Note: The task description says "Benefit = current_price - min_sell_price" but
 * the actual profit should account for tax on the sale:
 * - sell_after_tax = current_price * (1 - taxRate)
 * - profit = sell_after_tax - total_cost
 *
 * However, based on the epic description and Excel logic, it seems the min_sell_price
 * already includes the tax, so we calculate: profit = current_price - min_sell_price
 *
 * Dual Profitability:
 * For craftables that have a tradable recipe with limited uses, compute two
 * profitabilities so the user can compare:
 * 1. Profit WITHOUT recipe cost (crafting without buying the recipe)
 * 2. Profit WITH recipe cost (buying the tradable recipe, amortized over uses)
 *
 * Recipe cost comparison is shown when:
 * - A tradable recipe exists for the craftable, AND
 * - The recipe has limited uses (uses > 0)
 *
 * Formula with recipe cost:
 * - recipe_cost_per_craft = tradable_recipe_price / recipe_uses
 * - profit_with_recipe = profit_without_recipe - recipe_cost_per_craft
 * - profit_per_hour_with_recipe = profit_with_recipe / (craft_time / 3600)
 *
 * @param craftableRecipes - Array of craftable recipes with materials and market prices
 * @param taxRate - Market tax rate (e.g., 0.12 for 12%)
 * @param materialPriceMap - Map of material names to their current prices
 * @param recipes - Optional array of recipes for dual profitability calculation
 * @param materialLastSaleAtMap - Optional map of material names to their last sale timestamps
 * @param materialVendorValueMap - Optional map of material names to their vendor values (vendor-sold materials are excluded from low-confidence check)
 * @returns Array of potion profit results sorted by profit per hour descending
 */
export function calculateCraftableProfits(
  craftableRecipes: CraftableRecipe[],
  taxRate: number,
  materialPriceMap: Map<string, number>,
  recipes?: Recipe[],
  materialLastSaleAtMap?: Map<string, string>,
  materialVendorValueMap?: Map<string, number>
): CraftableProfitResult[] {
  // Create a map of craftable names to tradable recipes (if recipes provided)
  const craftableRecipeMap = new Map<string, Recipe>()

  if (recipes) {
    recipes.forEach((recipe) => {
      if (!recipe.producesItemName) return

      // Only consider tradable recipes that produce craftables
      if (!recipe.isUntradable && recipe.price > 0) {
        // If multiple recipes produce the same craftable, use the cheapest one
        const existingRecipe = craftableRecipeMap.get(recipe.producesItemName)
        if (!existingRecipe || recipe.price < existingRecipe.price) {
          craftableRecipeMap.set(recipe.producesItemName, recipe)
        }
      }
    })
  }

  const results: CraftableProfitResult[] = craftableRecipes.map((craftable) => {
    // Calculate material costs by looking up prices from materialPriceMap
    const materialResults: CraftableMaterialResult[] = craftable.materials.map((mat) => {
      const unitCost = materialPriceMap.get(mat.name)

      if (unitCost === undefined) {
        console.warn(`Material price not found for: ${mat.name}. Using 0.`)
        return {
          name: mat.name,
          quantity: mat.quantity,
          unitCost: 0,
          totalCost: 0,
        }
      }

      return {
        name: mat.name,
        quantity: mat.quantity,
        unitCost,
        totalCost: mat.quantity * unitCost,
      }
    })

    // Calculate total material cost
    const totalMaterialCost = materialResults.reduce((sum, mat) => sum + mat.totalCost, 0)

    // Total cost
    const totalCost = totalMaterialCost

    // Minimum sell price to break even after tax
    // If we sell at minSellPrice, after tax we get: minSellPrice * (1 - taxRate)
    // We want: minSellPrice * (1 - taxRate) = totalCost
    // So: minSellPrice = totalCost / (1 - taxRate)
    const minSellPrice = totalCost / (1 - taxRate)

    // Current market price after tax
    const sellAfterTax = craftable.currentPrice * (1 - taxRate)

    // Profit = what we get after tax - what we spent
    const profit = sellAfterTax - totalCost

    // Profit per hour
    const profitPerHour = profit / (craftable.timeSeconds / 3600)

    // Check if this craftable has a tradable recipe
    const tradableRecipe = craftableRecipeMap.get(craftable.name)

    // Gather material lastSaleAt timestamps for chain confidence check
    // Only check materials if the map is provided
    const materialLastSaleAts = materialLastSaleAtMap
      ? craftable.materials.map((mat) => materialLastSaleAtMap.get(mat.name))
      : undefined

    // Gather material vendor values - vendor-sold materials are excluded from confidence check
    const materialVendorValues = materialVendorValueMap
      ? craftable.materials.map((mat) => materialVendorValueMap.get(mat.name))
      : undefined

    // Base result
    // Note: isLowConfidence checks the ENTIRE crafting chain:
    // - craftable itself, tradable recipe (if any), and ALL materials (if map provided)
    // - Vendor-sold materials (vendorValue > 0) are excluded from confidence check
    // isRecipeLowConfidence is tracked separately for UI display on recipe cost line
    const result: CraftableProfitResult = {
      name: craftable.name,
      craftTimeSeconds: craftable.timeSeconds,
      materials: materialResults,
      totalCost,
      minSellPrice,
      currentPrice: craftable.currentPrice,
      profit,
      profitPerHour,
      hasRecipeCost: false,
      skill: craftable.skill || inferSkillFromMaterials(craftable.materials),
      isLowConfidence: isCraftableLowConfidence(
        craftable.lastSaleAt,
        tradableRecipe?.lastSaleAt,
        materialLastSaleAts,
        materialVendorValues
      ),
      isRecipeLowConfidence: tradableRecipe ? isRecipeLowConfidence(tradableRecipe.lastSaleAt) : false,
    }

    // Show dual profitability when:
    // 1. A tradable recipe exists for this craftable, AND
    // 2. The recipe has limited uses (uses > 0)
    if (tradableRecipe && tradableRecipe.uses && tradableRecipe.uses > 0) {
      const recipeCostPerCraft = tradableRecipe.price / tradableRecipe.uses
      const profitWithRecipeCost = profit - recipeCostPerCraft
      const profitPerHourWithRecipeCost = profitWithRecipeCost / (craftable.timeSeconds / 3600)

      result.hasRecipeCost = true
      // Main profit/profitPerHour become the recipe-cost-adjusted values
      result.profit = profitWithRecipeCost
      result.profitPerHour = profitPerHourWithRecipeCost
      // Store the without-recipe values for the tooltip
      result.profitWithRecipeCost = profit
      result.profitPerHourWithRecipeCost = profitPerHour
      result.recipeCostPerCraft = recipeCostPerCraft
      result.recipeUses = tradableRecipe.uses
      result.tradableRecipePrice = tradableRecipe.price
      result.tradableRecipeName = tradableRecipe.name
    }

    return result
  })

  // Sort by profit per hour descending
  return results.sort((a, b) => b.profitPerHour - a.profitPerHour)
}
