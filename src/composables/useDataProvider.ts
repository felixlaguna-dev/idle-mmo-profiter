/**
 * Data Provider Composable
 *
 * Unified data access layer with three-tier fallback:
 * 1. User manual overrides (localStorage) - highest priority
 * 2. API cached data - medium priority
 * 3. Default JSON data - lowest priority
 *
 * CRITICAL: Must work 100% without API key using default data
 */

import { ref, computed } from 'vue'
import type { DefaultData, Recipe, CraftableRecipe, ResourceRecipe } from '../types'
import defaultData from '../data/defaults.json'

// Storage keys
const STORAGE_PREFIX = 'idlemmo:'
const USER_OVERRIDES_KEY = `${STORAGE_PREFIX}user-overrides`
const CRAFTABLE_RECIPES_KEY = `${STORAGE_PREFIX}craftable-recipes`
const RESOURCE_RECIPES_KEY = `${STORAGE_PREFIX}resource-recipes`

/**
 * User overrides structure
 * Users can manually override any value in the default data
 */
interface UserOverrides {
  materials?: Record<
    string,
    {
      price?: number
      refreshExcluded?: boolean
      hashedId?: string
      vendorValue?: number
      lastSaleAt?: string
    }
  >
  craftables?: Record<
    string,
    {
      price?: number
      refreshExcluded?: boolean
      hashedId?: string
      vendorValue?: number
      lastSaleAt?: string
    }
  >
  resources?: Record<
    string,
    { marketPrice?: number; refreshExcluded?: boolean; hashedId?: string; vendorValue?: number }
  >
  recipes?: Record<
    string,
    {
      price?: number
      chance?: number
      value?: number
      refreshExcluded?: boolean
      hashedId?: string
      vendorValue?: number
      uses?: number
      producesItemName?: string
      producesItemHashedId?: string
      isUntradable?: boolean
      tradableCounterpartId?: string
      lastSaleAt?: string
    }
  >
}

/**
 * Get user overrides from localStorage
 */
function getUserOverrides(): UserOverrides {
  try {
    const stored = localStorage.getItem(USER_OVERRIDES_KEY)
    if (!stored) {
      return {}
    }
    return JSON.parse(stored)
  } catch (error) {
    console.error('Failed to load user overrides:', error)
    return {}
  }
}

/**
 * Save user overrides to localStorage
 */
function saveUserOverrides(overrides: UserOverrides): void {
  try {
    localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(overrides))
  } catch (error) {
    console.error('Failed to save user overrides:', error)
  }
}

/**
 * Save craftableRecipes to localStorage
 */
function saveCraftableRecipes(craftableRecipes: DefaultData['craftableRecipes']): void {
  try {
    localStorage.setItem(CRAFTABLE_RECIPES_KEY, JSON.stringify(craftableRecipes))
  } catch (error) {
    console.error('Failed to save craftable recipes:', error)
  }
}

/**
 * Load craftableRecipes from localStorage, merging with defaults
 */
function loadCraftableRecipes(
  defaultCrafts: DefaultData['craftableRecipes']
): DefaultData['craftableRecipes'] {
  try {
    const stored = localStorage.getItem(CRAFTABLE_RECIPES_KEY)
    if (!stored) return defaultCrafts

    const savedCrafts = JSON.parse(stored) as DefaultData['craftableRecipes']
    // Use saved crafts as the source of truth (includes additions, removals, time edits)
    // But merge lastSaleAt and weeklySalesVolume from defaults for low-confidence and volume detection
    const defaultLastSaleAt = new Map<string, string>()
    const defaultWeeklySalesVolume = new Map<string, number>()
    defaultCrafts.forEach((craft) => {
      if (craft.lastSaleAt) {
        defaultLastSaleAt.set(craft.name, craft.lastSaleAt)
      }
      if (craft.weeklySalesVolume !== undefined) {
        defaultWeeklySalesVolume.set(craft.name, craft.weeklySalesVolume)
      }
    })

    return savedCrafts.map((craft) => {
      const lastSaleAt = defaultLastSaleAt.get(craft.name)
      const weeklySalesVolume = defaultWeeklySalesVolume.get(craft.name)
      const updates: Partial<CraftableRecipe> = {}
      if (lastSaleAt) updates.lastSaleAt = lastSaleAt
      if (weeklySalesVolume !== undefined) updates.weeklySalesVolume = weeklySalesVolume
      return Object.keys(updates).length > 0 ? { ...craft, ...updates } : craft
    })
  } catch (error) {
    console.error('Failed to load craftable recipes:', error)
    return defaultCrafts
  }
}

/**
 * Save resourceRecipes to localStorage
 */
function saveResourceRecipes(resourceRecipes: DefaultData['resourceRecipes']): void {
  try {
    localStorage.setItem(RESOURCE_RECIPES_KEY, JSON.stringify(resourceRecipes))
  } catch (error) {
    console.error('Failed to save resource recipes:', error)
  }
}

/**
 * Load resourceRecipes from localStorage, merging with defaults
 */
function loadResourceRecipes(
  defaultRecipes: DefaultData['resourceRecipes']
): DefaultData['resourceRecipes'] {
  try {
    const stored = localStorage.getItem(RESOURCE_RECIPES_KEY)
    if (!stored) return defaultRecipes || []

    const savedRecipes = JSON.parse(stored) as DefaultData['resourceRecipes']
    if (!savedRecipes) return defaultRecipes || []

    // Use saved recipes as the source of truth (includes additions, removals, time edits)
    // But merge lastSaleAt and weeklySalesVolume from defaults for low-confidence detection
    const defaultLastSaleAt = new Map<string, string>()
    const defaultWeeklySalesVolume = new Map<string, number>()
    ;(defaultRecipes || []).forEach((recipe) => {
      if (recipe.lastSaleAt) {
        defaultLastSaleAt.set(recipe.name, recipe.lastSaleAt)
      }
      if (recipe.weeklySalesVolume !== undefined) {
        defaultWeeklySalesVolume.set(recipe.name, recipe.weeklySalesVolume)
      }
    })

    return savedRecipes.map((recipe) => {
      const lastSaleAt = defaultLastSaleAt.get(recipe.name)
      const weeklySalesVolume = defaultWeeklySalesVolume.get(recipe.name)
      const updates: Partial<ResourceRecipe> = {}
      if (lastSaleAt) updates.lastSaleAt = lastSaleAt
      if (weeklySalesVolume !== undefined) updates.weeklySalesVolume = weeklySalesVolume
      return Object.keys(updates).length > 0 ? { ...recipe, ...updates } : recipe
    })
  } catch (error) {
    console.error('Failed to load resource recipes:', error)
    return defaultRecipes || []
  }
}

// Singleton instance - created once and shared across all calls
let dataProviderInstance: ReturnType<typeof createDataProvider> | null = null

/**
 * Create data provider instance
 * This is called once and the result is cached
 */
function createDataProvider() {
  // One-time migration: Move data from old prefix to new prefix
  // Old key: 'idlemmo-user-overrides'
  // New key: 'idlemmo:user-overrides'
  const oldKey = 'idlemmo-user-overrides'
  const newKey = 'idlemmo:user-overrides'

  try {
    const oldData = localStorage.getItem(oldKey)
    const newData = localStorage.getItem(newKey)

    // Only migrate if old key exists and new key does NOT exist
    if (oldData && !newData) {
      localStorage.setItem(newKey, oldData)
      localStorage.removeItem(oldKey)
      console.log('Migrated user overrides from old storage key to new storage key')
    }
  } catch (error) {
    console.error('Failed to migrate user overrides:', error)
  }

  // One-time migration: Rename potion-crafts to craftable-recipes
  const oldCraftsKey = 'idlemmo:potion-crafts'
  const newCraftsKey = 'idlemmo:craftable-recipes'
  try {
    const oldCraftsData = localStorage.getItem(oldCraftsKey)
    const newCraftsData = localStorage.getItem(newCraftsKey)

    if (oldCraftsData && !newCraftsData) {
      localStorage.setItem(newCraftsKey, oldCraftsData)
      localStorage.removeItem(oldCraftsKey)
      console.log('Migrated craftable recipes from old storage key to new storage key')
    }
  } catch (error) {
    console.error('Failed to migrate craftable recipes:', error)
  }

  // One-time migration: Rename 'potions' to 'craftables' in user overrides
  try {
    const overridesData = localStorage.getItem(USER_OVERRIDES_KEY)
    if (overridesData) {
      const overrides = JSON.parse(overridesData)
      if (overrides.potions && !overrides.craftables) {
        overrides.craftables = overrides.potions
        delete overrides.potions
        localStorage.setItem(USER_OVERRIDES_KEY, JSON.stringify(overrides))
        console.log('Migrated user overrides: renamed potions to craftables')
      }
    }
  } catch (error) {
    console.error('Failed to migrate user overrides potions key:', error)
  }

  // Load default data (cast to DefaultData type)
  const loadedDefaults = defaultData as DefaultData
  // Restore persisted craftableRecipes (includes user additions/removals/edits)
  loadedDefaults.craftableRecipes = loadCraftableRecipes(loadedDefaults.craftableRecipes)
  // Restore persisted resourceRecipes (includes user additions/removals/edits)
  loadedDefaults.resourceRecipes = loadResourceRecipes(loadedDefaults.resourceRecipes)

  // CRITICAL: Sync materials and craftables from craftableRecipes
  // This ensures that all ingredients and outputs referenced by craftableRecipes
  // exist in the materials and craftables arrays, preventing the Market tab bug
  // where items disappear after reset-to-defaults.
  const materialNames = new Set(loadedDefaults.materials.map((m) => m.name))
  const craftableNames = new Set(loadedDefaults.craftables.map((c) => c.name))

  for (const recipe of loadedDefaults.craftableRecipes) {
    // Sync materials (ingredients)
    for (const mat of recipe.materials) {
      if (!materialNames.has(mat.name)) {
        const id = `mat-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        loadedDefaults.materials.push({
          id,
          name: mat.name,
          price: 0, // Will be resolved from market data or overrides
          hashedId: '',
          vendorValue: 0,
        })
        materialNames.add(mat.name)
      }
    }

    // Sync craftable output items
    if (!craftableNames.has(recipe.name)) {
      const id = `craft-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      // Look up the matching recipe to get the producesItemHashedId and producesItemVendorValue
      const matchingRecipe = loadedDefaults.recipes.find((r) => r.producesItemName === recipe.name)
      const hashedId = matchingRecipe?.producesItemHashedId || ''
      const vendorValue = matchingRecipe?.producesItemVendorValue ?? 0

      loadedDefaults.craftables.push({
        id,
        name: recipe.name,
        price: recipe.currentPrice,
        hashedId,
        vendorValue,
        // Copy lastSaleAt from craftableRecipe for low-confidence detection
        lastSaleAt: recipe.lastSaleAt,
        // Copy weeklySalesVolume from craftableRecipe for volume tier detection
        weeklySalesVolume: recipe.weeklySalesVolume,
      })
      craftableNames.add(recipe.name)
    }
  }

  const defaults = ref(loadedDefaults)

  // Load user overrides
  const userOverrides = ref<UserOverrides>(getUserOverrides())

  /**
   * Apply user overrides to default data
   */
  function applyOverrides<T extends Record<string, unknown>>(
    defaultItems: T[],
    overrides: Record<string, Partial<T>> | undefined,
    idField: keyof T = 'id' as keyof T
  ): T[] {
    if (!overrides) {
      return defaultItems
    }

    return defaultItems.map((item) => {
      const id = item[idField] as string
      const override = overrides[id]

      if (!override) {
        return item
      }

      return { ...item, ...override }
    })
  }

  /**
   * Merged data with user overrides applied
   */
  const materials = computed(() => {
    return applyOverrides(defaults.value.materials, userOverrides.value.materials)
  })

  const craftables = computed(() => {
    return applyOverrides(defaults.value.craftables, userOverrides.value.craftables)
  })

  const resources = computed(() => {
    return applyOverrides(defaults.value.resources, userOverrides.value.resources)
  })

  const recipes = computed(() => {
    return applyOverrides(defaults.value.recipes, userOverrides.value.recipes)
  })

  const dungeons = computed(() => defaults.value.dungeons)
  const magicFindDefaults = computed(() => defaults.value.magicFindDefaults)
  const marketTaxRate = computed(() => defaults.value.marketTaxRate)

  /**
   * All items array from defaults.json
   * This contains items not in any specific category (populated by populate-all-items script)
   */
  const allItems = computed(() => defaults.value.allItems || [])

  /**
   * Efficiency items array from defaults.json
   * Contains items with efficiency effects for resource skills
   */
  const efficiencyItems = computed(() => defaults.value.efficiencyItems || [])

  /**
   * Create lookup maps for material, craftable, and resource prices
   * These allow us to apply overrides to activity data
   */
  const materialPriceMap = computed(() => {
    const map = new Map<string, number>()
    materials.value.forEach((mat) => {
      map.set(mat.name, mat.price)
    })
    return map
  })

  /**
   * Map of material names to their lastSaleAt timestamps
   * Used for low-confidence detection in crafting chain
   */
  const materialLastSaleAtMap = computed(() => {
    const map = new Map<string, string>()
    materials.value.forEach((mat) => {
      if (mat.lastSaleAt) {
        map.set(mat.name, mat.lastSaleAt)
      }
    })
    return map
  })

  /**
   * Map of material names to their vendorValue
   * Used to exclude vendor-sold materials from low-confidence detection
   */
  const materialVendorValueMap = computed(() => {
    const map = new Map<string, number>()
    materials.value.forEach((mat) => {
      if (mat.vendorValue) {
        map.set(mat.name, mat.vendorValue)
      }
    })
    return map
  })

  const craftablePriceMap = computed(() => {
    const map = new Map<string, number>()
    craftables.value.forEach((craft) => {
      map.set(craft.name, craft.price)
    })
    return map
  })

  const resourcePriceMap = computed(() => {
    const map = new Map<string, number>()
    resources.value.forEach((res) => {
      map.set(res.name, res.marketPrice)
    })
    return map
  })

  /**
   * Map of raw resource/material names to their market prices
   * Built from resourceGathering with user overrides applied.
   * Also seeds from resourceRecipes outputs so that recipe outputs used as
   * cross-recipe materials (e.g. Iron Bar used in Iron Fitting) resolve
   * to their current market price rather than 0.
   * Used for recipe material cost lookups (e.g., Lantern Fish, Coal, ores, logs)
   */
  const rawResourcePriceMap = computed(() => {
    const map = new Map<string, number>()
    // Seed from resourceRecipes outputs first (lower priority baseline)
    // This allows recipe outputs (e.g. Iron Bar from smelting) to be used
    // as materials in other recipes (e.g. Iron Fitting construction recipe)
    ;(defaults.value.resourceRecipes || []).forEach((recipe) => {
      map.set(recipe.name, recipe.currentPrice)
    })
    // Seed from resourceGathering (overrides recipe prices if same name exists)
    defaults.value.resourceGathering.forEach((gather) => {
      map.set(gather.name, gather.marketPrice)
    })
    // Apply user overrides for resource prices (highest priority)
    if (userOverrides.value.resources) {
      for (const [name, override] of Object.entries(userOverrides.value.resources)) {
        if (override.marketPrice !== undefined) {
          map.set(name, override.marketPrice)
        }
      }
    }
    return map
  })

  /**
   * CraftableRecipes with craftable prices updated from overrides
   * Material prices are resolved via materialPriceMap by the calculator
   */
  const craftableRecipes = computed(() => {
    return defaults.value.craftableRecipes.map((craft) => {
      // Update current price from craftable price overrides
      const updatedPrice = craftablePriceMap.value.get(craft.name) ?? craft.currentPrice

      return {
        ...craft,
        currentPrice: updatedPrice,
      }
    })
  })

  /**
   * ResourceRecipes with prices updated from overrides
   * Material prices are resolved via materialPriceMap
   */
  const resourceRecipes = computed(() => {
    return (defaults.value.resourceRecipes || []).map((recipe) => {
      // Update current price from resource price overrides
      const updatedPrice = resourcePriceMap.value.get(recipe.name) ?? recipe.currentPrice

      return {
        ...recipe,
        currentPrice: updatedPrice,
      }
    })
  })

  /**
   * Auto-generate 3 ResourceGather entries per ResourceRecipe
   * 1. Buy All mode: All materials at market price, craft time only
   * 2. Gather Except Coal mode: Gather all non-coal materials (includes gather times + bait costs)
   * 3. Gather All mode: Gather ALL materials (includes all gather times + bait costs)
   *
   * Fishing materials include bait costs:
   * - Cheap Bait (2g): Cod, Salmon, Tuna
   * - Tarnished Bait (4g): Trout, Perch
   * - Gleaming Bait (7g): Herring, Sardines
   * - Elemental Bait (12g): Lobster, Crab
   * - Eldritch Bait (16g): Turtle, Stingray
   * - Arcane Bait (25g): Lantern Fish, Great White Shark
   */
  const resourceGatheringFromRecipes = computed(() => {
    const gatherEntries: typeof defaults.value.resourceGathering = []

    // Build lookup maps for raw gathered resources (leaves of the dependency tree)
    const rawGatherTimeMap = new Map<string, number>()
    const rawBaseCostMap = new Map<string, number>()
    defaults.value.resourceGathering.forEach((gather) => {
      rawGatherTimeMap.set(gather.name, gather.timeSeconds)
      rawBaseCostMap.set(gather.name, gather.baseCost)
    })

    // Build lookup map for sub-recipes (intermediate crafted materials)
    const recipeMap = new Map<string, (typeof defaults.value.resourceRecipes)[0]>()
    ;(defaults.value.resourceRecipes || []).forEach((recipe) => {
      recipeMap.set(recipe.name, recipe)
    })

    /**
     * Recursively resolves gather time and base cost for a single material unit.
     *
     * @param materialName - Name of the material to resolve
     * @param excludeCoal - If true, coal is purchased at market price instead of gathered
     * @param visited - Cycle-detection set of recipe names currently being resolved
     * @returns { totalTime, totalBaseCost } for one unit of the material
     */
    function resolveMaterial(
      materialName: string,
      excludeCoal: boolean,
      visited: Set<string>,
    ): { totalTime: number; totalBaseCost: number } {
      // Coal special case: in "gather except coal" mode, buy at market price
      if (excludeCoal && materialName.toLowerCase() === 'coal') {
        const coalPrice = rawResourcePriceMap.value.get(materialName) ?? 0
        return { totalTime: 0, totalBaseCost: coalPrice }
      }

      // Raw gathered resource (leaf node)
      if (rawGatherTimeMap.has(materialName)) {
        return {
          totalTime: rawGatherTimeMap.get(materialName)!,
          totalBaseCost: rawBaseCostMap.get(materialName) ?? 0,
        }
      }

      // Sub-recipe (intermediate crafted material)
      const subRecipe = recipeMap.get(materialName)
      if (subRecipe && !visited.has(materialName)) {
        const nextVisited = new Set(visited)
        nextVisited.add(materialName)

        let subTime = subRecipe.timeSeconds
        let subBaseCost = 0

        for (const subMat of subRecipe.materials) {
          const resolved = resolveMaterial(subMat.name, excludeCoal, nextVisited)
          subTime += resolved.totalTime * subMat.quantity
          subBaseCost += resolved.totalBaseCost * subMat.quantity
        }

        return { totalTime: subTime, totalBaseCost: subBaseCost }
      }

      // Unknown material — resolve to zero (no gather time, no cost)
      return { totalTime: 0, totalBaseCost: 0 }
    }

    for (const recipe of resourceRecipes.value) {
      // Mode 1: Buy All - All materials at market price, craft time only
      const buyAllCost = recipe.materials.reduce((sum, mat) => {
        const matPrice = rawResourcePriceMap.value.get(mat.name) ?? 0
        return sum + matPrice * mat.quantity
      }, 0)

      gatherEntries.push({
        name: recipe.name,
        timeSeconds: recipe.timeSeconds,
        baseCost: buyAllCost,
        inputs: [],
        vendorValue: recipe.vendorValue,
        marketPrice: recipe.currentPrice,
        cost: buyAllCost,
      })

      // Mode 2: Gather Except Coal - Gather all raw materials, buy coal at market price
      let gatherExceptCoalTime = recipe.timeSeconds
      let gatherExceptCoalBaseCost = 0

      for (const mat of recipe.materials) {
        const resolved = resolveMaterial(mat.name, true, new Set([recipe.name]))
        gatherExceptCoalTime += resolved.totalTime * mat.quantity
        gatherExceptCoalBaseCost += resolved.totalBaseCost * mat.quantity
      }

      gatherEntries.push({
        name: `${recipe.name} (gather)`,
        timeSeconds: gatherExceptCoalTime,
        baseCost: gatherExceptCoalBaseCost,
        inputs: [],
        vendorValue: recipe.vendorValue,
        marketPrice: recipe.currentPrice,
        cost: gatherExceptCoalBaseCost,
      })

      // Mode 3: Gather All - Gather ALL materials including coal
      let gatherAllTime = recipe.timeSeconds
      let gatherAllBaseCost = 0

      for (const mat of recipe.materials) {
        const resolved = resolveMaterial(mat.name, false, new Set([recipe.name]))
        gatherAllTime += resolved.totalTime * mat.quantity
        gatherAllBaseCost += resolved.totalBaseCost * mat.quantity
      }

      gatherEntries.push({
        name: `${recipe.name} (gather all)`,
        timeSeconds: gatherAllTime,
        baseCost: gatherAllBaseCost,
        inputs: [],
        vendorValue: recipe.vendorValue,
        marketPrice: recipe.currentPrice,
        cost: gatherAllBaseCost,
      })
    }

    return gatherEntries
  })

  /**
   * ResourceGathering with market prices and costs updated from overrides
   * This ensures that when a user edits a resource price in the Market tab,
   * it flows through to the resource gathering calculations.
   *
   * Cost is computed as: baseCost + sum of input costs
   * where input cost = quantity * (useMarketPrice ? marketPrice : baseCost)
   *
   * This now merges:
   * 1. Manual entries from defaults.json
   * 2. Auto-generated entries from resourceRecipes (3 modes per recipe)
   */
  const resourceGathering = computed(() => {
    // First pass: create a map to store all resources (manual entries from defaults.json)
    const resourceMap = new Map<string, (typeof defaults.value.resourceGathering)[0]>()
    defaults.value.resourceGathering.forEach((gather) => {
      resourceMap.set(gather.name, gather)
    })

    // Process manual entries from defaults.json
    const manualEntries = defaults.value.resourceGathering.map((gather) => {
      // Update market price from resource price overrides
      const updatedPrice = resourcePriceMap.value.get(gather.name) ?? gather.marketPrice

      // Compute cost dynamically from inputs
      let computedCost = gather.baseCost

      if (gather.inputs && gather.inputs.length > 0) {
        for (const input of gather.inputs) {
          const inputResource = resourceMap.get(input.resourceName)

          if (!inputResource) {
            console.warn(`Resource input not found: ${input.resourceName}`)
            continue
          }

          // Get the input price (either market price or base cost)
          let inputPrice: number
          if (input.useMarketPrice) {
            // Use market price from overrides or default
            inputPrice = resourcePriceMap.value.get(input.resourceName) ?? inputResource.marketPrice
          } else {
            // Use base cost (for nested resources)
            inputPrice = inputResource.baseCost
          }

          computedCost += input.quantity * inputPrice
        }
      }

      return {
        ...gather,
        marketPrice: updatedPrice,
        cost: computedCost,
      }
    })

    // Merge manual entries with auto-generated entries from resourceRecipes
    return [...manualEntries, ...resourceGatheringFromRecipes.value]
  })

  /**
   * Update a single material price
   */
  function updateMaterialPrice(id: string, price: number): void {
    const overrides = { ...userOverrides.value }

    if (!overrides.materials) {
      overrides.materials = {}
    }

    overrides.materials[id] = { ...overrides.materials[id], price }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Update a single craftable price
   */
  function updateCraftablePrice(id: string, price: number): void {
    const overrides = { ...userOverrides.value }

    if (!overrides.craftables) {
      overrides.craftables = {}
    }

    overrides.craftables[id] = { ...overrides.craftables[id], price }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Update a single resource market price
   */
  function updateResourcePrice(id: string, marketPrice: number): void {
    const overrides = { ...userOverrides.value }

    if (!overrides.resources) {
      overrides.resources = {}
    }

    overrides.resources[id] = { ...overrides.resources[id], marketPrice }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Update recipe data
   */
  function updateRecipe(
    id: string,
    data: { price?: number; chance?: number; value?: number }
  ): void {
    const overrides = { ...userOverrides.value }

    if (!overrides.recipes) {
      overrides.recipes = {}
    }

    overrides.recipes[id] = { ...overrides.recipes[id], ...data }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Clear all user overrides for a specific category
   */
  function clearCategoryOverrides(
    category: 'materials' | 'craftables' | 'resources' | 'recipes'
  ): void {
    const overrides = { ...userOverrides.value }
    delete overrides[category]
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Clear all user overrides
   */
  function clearAllOverrides(): void {
    userOverrides.value = {}
    saveUserOverrides({})
  }

  /**
   * Update hashedId for an item — persisted to localStorage via user overrides
   */
  function updateHashedId(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    id: string,
    hashedId: string
  ): void {
    // Update in-memory defaults
    const item = defaults.value[category].find((item: { id: string }) => item.id === id)
    if (item) {
      ;(item as { hashedId?: string }).hashedId = hashedId
    }
    // Persist to localStorage via user overrides
    const overrides = { ...userOverrides.value }
    if (!overrides[category]) {
      overrides[category] = {} as Record<string, never>
    }
    const categoryOverrides = overrides[category]!
    categoryOverrides[id] = { ...categoryOverrides[id], hashedId }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Update vendorValue for an item — persisted to localStorage via user overrides
   */
  function updateVendorValue(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    id: string,
    vendorValue: number
  ): void {
    const overrides = { ...userOverrides.value }
    if (!overrides[category]) {
      overrides[category] = {} as Record<string, never>
    }
    const categoryOverrides = overrides[category]!
    categoryOverrides[id] = { ...categoryOverrides[id], vendorValue }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Update lastSaleAt timestamp for an item — persisted to localStorage via user overrides
   * This stores the most recent sale timestamp from the market history API.
   */
  function updateLastSaleAt(
    category: 'materials' | 'craftables' | 'recipes',
    id: string,
    lastSaleAt: string
  ): void {
    const overrides = { ...userOverrides.value }
    if (!overrides[category]) {
      overrides[category] = {} as Record<string, never>
    }
    const categoryOverrides = overrides[category]!
    categoryOverrides[id] = { ...categoryOverrides[id], lastSaleAt }
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Check if an item has user overrides
   */
  function hasOverride(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    id: string
  ): boolean {
    return !!userOverrides.value[category]?.[id]
  }

  /**
   * Import data from API cache
   * This would be called when API data is fetched and cached
   * For now, it's a placeholder for future API integration
   */
  function importFromApiCache(): void {
    // TODO: Implement when API integration is ready
    // This will check the API cache and merge it with default data
    console.log('API cache import not yet implemented')
  }

  /**
   * Reload user overrides from localStorage
   * Useful if another tab modified the data
   */
  function reloadOverrides(): void {
    userOverrides.value = getUserOverrides()
  }

  /**
   * Get statistics about user overrides
   */
  function getOverrideStats() {
    const stats = {
      materials: Object.keys(userOverrides.value.materials || {}).length,
      craftables: Object.keys(userOverrides.value.craftables || {}).length,
      resources: Object.keys(userOverrides.value.resources || {}).length,
      recipes: Object.keys(userOverrides.value.recipes || {}).length,
    }

    const total = stats.materials + stats.craftables + stats.resources + stats.recipes

    return { ...stats, total }
  }

  /**
   * Set refresh exclusion state for a single item
   */
  function setRefreshExcluded(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    id: string,
    excluded: boolean
  ): void {
    const overrides = { ...userOverrides.value }

    if (!overrides[category]) {
      overrides[category] = {}
    }

    if (!overrides[category]![id]) {
      overrides[category]![id] = {}
    }

    overrides[category]![id].refreshExcluded = excluded
    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Check if an item is excluded from refresh
   */
  function isRefreshExcluded(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    id: string
  ): boolean {
    return userOverrides.value[category]?.[id]?.refreshExcluded ?? false
  }

  /**
   * Bulk set refresh exclusion for all items in a category
   */
  function setAllRefreshExcluded(
    category: 'materials' | 'craftables' | 'resources' | 'recipes',
    excluded: boolean
  ): void {
    const overrides = { ...userOverrides.value }

    if (!overrides[category]) {
      overrides[category] = {}
    }

    // Get all items from the category
    let itemIds: string[] = []
    switch (category) {
      case 'materials':
        itemIds = defaults.value.materials.map((item) => item.id)
        break
      case 'craftables':
        itemIds = defaults.value.craftables.map((item) => item.id)
        break
      case 'resources':
        itemIds = defaults.value.resources.map((item) => item.id)
        break
      case 'recipes':
        itemIds = defaults.value.recipes.map((item) => item.id)
        break
    }

    // Set exclusion state for all items
    itemIds.forEach((id) => {
      if (!overrides[category]![id]) {
        overrides[category]![id] = {}
      }
      overrides[category]![id].refreshExcluded = excluded
    })

    userOverrides.value = overrides
    saveUserOverrides(overrides)
  }

  /**
   * Get exclusion statistics for a specific category or all categories
   */
  function getExclusionStats(category?: 'materials' | 'craftables' | 'resources' | 'recipes') {
    if (category) {
      // Stats for a specific category
      let totalItems = 0
      switch (category) {
        case 'materials':
          totalItems = defaults.value.materials.length
          break
        case 'craftables':
          totalItems = defaults.value.craftables.length
          break
        case 'resources':
          totalItems = defaults.value.resources.length
          break
        case 'recipes':
          totalItems = defaults.value.recipes.length
          break
      }

      const excluded = Object.values(userOverrides.value[category] || {}).filter(
        (override) => override.refreshExcluded === true
      ).length

      return {
        total: totalItems,
        excluded,
        included: totalItems - excluded,
      }
    }

    // Stats for all categories
    const materialsTotal = defaults.value.materials.length
    const craftablesTotal = defaults.value.craftables.length
    const resourcesTotal = defaults.value.resources.length
    const recipesTotal = defaults.value.recipes.length

    const materialsExcluded = Object.values(userOverrides.value.materials || {}).filter(
      (override) => override.refreshExcluded === true
    ).length

    const craftablesExcluded = Object.values(userOverrides.value.craftables || {}).filter(
      (override) => override.refreshExcluded === true
    ).length

    const resourcesExcluded = Object.values(userOverrides.value.resources || {}).filter(
      (override) => override.refreshExcluded === true
    ).length

    const recipesExcluded = Object.values(userOverrides.value.recipes || {}).filter(
      (override) => override.refreshExcluded === true
    ).length

    const totalItems = materialsTotal + craftablesTotal + resourcesTotal + recipesTotal
    const totalExcluded =
      materialsExcluded + craftablesExcluded + resourcesExcluded + recipesExcluded

    return {
      materials: {
        total: materialsTotal,
        excluded: materialsExcluded,
        included: materialsTotal - materialsExcluded,
      },
      craftables: {
        total: craftablesTotal,
        excluded: craftablesExcluded,
        included: craftablesTotal - craftablesExcluded,
      },
      resources: {
        total: resourcesTotal,
        excluded: resourcesExcluded,
        included: resourcesTotal - resourcesExcluded,
      },
      recipes: {
        total: recipesTotal,
        excluded: recipesExcluded,
        included: recipesTotal - recipesExcluded,
      },
      total: totalItems,
      totalExcluded,
      totalIncluded: totalItems - totalExcluded,
    }
  }

  /**
   * Add a new CraftableRecipe entry to the defaults
   */
  function addCraftableRecipe(craftableRecipe: {
    name: string
    timeSeconds: number
    materials: Array<{ name: string; quantity: number }>
    currentPrice: number
    skill?: 'alchemy' | 'forging'
  }): void {
    defaults.value.craftableRecipes.push(craftableRecipe)

    // Sync the craftable output item (if it doesn't already exist)
    const existing = defaults.value.craftables.find((c) => c.name === craftableRecipe.name)
    if (!existing) {
      const id = `craft-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

      // Look up the matching recipe to get the producesItemHashedId and producesItemVendorValue
      const matchingRecipe = defaults.value.recipes.find(
        (r) => r.producesItemName === craftableRecipe.name
      )
      const hashedId = matchingRecipe?.producesItemHashedId || ''
      const vendorValue = matchingRecipe?.producesItemVendorValue ?? 0

      defaults.value.craftables.push({
        id,
        name: craftableRecipe.name,
        price: craftableRecipe.currentPrice,
        hashedId,
        vendorValue,
      })
    }

    defaults.value = { ...defaults.value }
    saveCraftableRecipes(defaults.value.craftableRecipes)
  }

  /**
   * Add a new Material entry to the defaults (if it doesn't already exist)
   */
  function addMaterial(material: {
    name: string
    price: number
    hashedId?: string
    vendorValue?: number
  }): string {
    const existing = materials.value.find((m) => m.name === material.name)
    if (existing) return existing.id

    const id = `mat-auto-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    defaults.value.materials.push({
      id,
      name: material.name,
      price: material.price,
      hashedId: material.hashedId || '',
      vendorValue: material.vendorValue || 0,
    })
    defaults.value = { ...defaults.value }
    return id
  }

  /**
   * Add a new Craftable entry to the defaults (if it doesn't already exist)
   */
  function addCraftable(craftable: {
    name: string
    price: number
    hashedId?: string
    vendorValue?: number
  }): string {
    const existing = craftables.value.find((c) => c.name === craftable.name)
    if (existing) return existing.id

    const id = `craft-auto-${Date.now()}`
    defaults.value.craftables.push({
      id,
      name: craftable.name,
      price: craftable.price,
      hashedId: craftable.hashedId || '',
      vendorValue: craftable.vendorValue || 0,
    })
    defaults.value = { ...defaults.value }
    return id
  }

  /**
   * Update a CraftableRecipe's craft time by craftable name
   */
  function updateCraftableRecipeTime(craftableName: string, timeSeconds: number): void {
    const craft = defaults.value.craftableRecipes.find((c) => c.name === craftableName)
    if (craft) {
      craft.timeSeconds = timeSeconds
      defaults.value = { ...defaults.value }
      saveCraftableRecipes(defaults.value.craftableRecipes)
    }
  }

  /**
   * Remove a CraftableRecipe entry by name
   */
  function removeCraftableRecipe(name: string): void {
    defaults.value.craftableRecipes = defaults.value.craftableRecipes.filter(
      (craft) => craft.name !== name
    )
    defaults.value = { ...defaults.value }
    saveCraftableRecipes(defaults.value.craftableRecipes)
  }

  /**
   * Add a new ResourceRecipe entry to the defaults
   */
  function addResourceRecipe(resourceRecipe: {
    name: string
    timeSeconds: number
    skill: ResourceRecipe['skill']
    materials: Array<{ name: string; quantity: number }>
    currentPrice: number
    vendorValue: number
    hashedId?: string
  }): void {
    if (!defaults.value.resourceRecipes) {
      defaults.value.resourceRecipes = []
    }
    defaults.value.resourceRecipes.push(resourceRecipe)
    defaults.value = { ...defaults.value }
    saveResourceRecipes(defaults.value.resourceRecipes)
  }

  /**
   * Update a ResourceRecipe's craft time by name
   */
  function updateResourceRecipeTime(name: string, timeSeconds: number): void {
    if (!defaults.value.resourceRecipes) return
    const recipe = defaults.value.resourceRecipes.find((r) => r.name === name)
    if (recipe) {
      recipe.timeSeconds = timeSeconds
      defaults.value = { ...defaults.value }
      saveResourceRecipes(defaults.value.resourceRecipes)
    }
  }

  /**
   * Remove a ResourceRecipe entry by name
   */
  function removeResourceRecipe(name: string): void {
    if (!defaults.value.resourceRecipes) return
    defaults.value.resourceRecipes = defaults.value.resourceRecipes.filter(
      (recipe) => recipe.name !== name
    )
    defaults.value = { ...defaults.value }
    saveResourceRecipes(defaults.value.resourceRecipes)
  }

  /**
   * Update a recipe's structural fields in defaults (uses, producesItemName, etc.)
   * Persisted to localStorage via user overrides so they survive refresh.
   */
  function updateRecipeDefaults(id: string, data: Partial<Recipe>): void {
    const recipe = defaults.value.recipes.find((r) => r.id === id)
    if (recipe) {
      Object.assign(recipe, data)
      defaults.value = { ...defaults.value }

      // Persist structural fields to user overrides
      const overrides = { ...userOverrides.value }
      if (!overrides.recipes) {
        overrides.recipes = {}
      }
      overrides.recipes[id] = { ...overrides.recipes[id], ...data }
      userOverrides.value = overrides
      saveUserOverrides(overrides)
    }
  }

  /**
   * Export current data as a defaults.json compatible JSON string
   *
   * This creates a complete DefaultData object with all user overrides merged in,
   * producing a drop-in replacement for src/data/defaults.json
   */
  function exportAsDefaultsJson(): string {
    // Build the complete data object with user overrides applied
    // Use computed arrays which already have overrides merged
    const exportData: DefaultData = {
      materials: materials.value.map((mat) => ({
        id: mat.id,
        name: mat.name,
        price: mat.price,
        hashedId: mat.hashedId || '',
        vendorValue: mat.vendorValue || 0,
      })),
      craftables: craftables.value.map((craft) => ({
        id: craft.id,
        name: craft.name,
        price: craft.price,
        hashedId: craft.hashedId || '',
        vendorValue: craft.vendorValue || 0,
      })),
      resources: resources.value.map((res) => ({
        id: res.id,
        name: res.name,
        marketPrice: res.marketPrice,
        vendorValue: res.vendorValue,
        hashedId: res.hashedId || '',
      })),
      recipes: recipes.value.map((recipe) => {
        const exported: Recipe = {
          id: recipe.id,
          name: recipe.name,
          price: recipe.price,
          chance: recipe.chance,
          hashedId: recipe.hashedId || '',
          vendorValue: recipe.vendorValue || 0,
        }
        if (recipe.value !== undefined) exported.value = recipe.value
        if (recipe.uses !== undefined) exported.uses = recipe.uses
        if (recipe.producesItemName) exported.producesItemName = recipe.producesItemName
        if (recipe.producesItemHashedId) exported.producesItemHashedId = recipe.producesItemHashedId
        if (recipe.isUntradable !== undefined) exported.isUntradable = recipe.isUntradable
        if (recipe.tradableCounterpartId)
          exported.tradableCounterpartId = recipe.tradableCounterpartId
        return exported
      }),
      dungeons: dungeons.value,
      craftableRecipes: craftableRecipes.value.map((craft) => ({
        name: craft.name,
        skill: craft.skill,
        timeSeconds: craft.timeSeconds,
        materials: craft.materials.map((mat) => ({
          name: mat.name,
          quantity: mat.quantity,
        })),
        currentPrice: craft.currentPrice,
      })),
      resourceGathering: resourceGathering.value.map((gather) => {
        // Strip the computed 'cost' field - it doesn't exist in defaults.json
        const exported: {
          name: string
          timeSeconds: number
          baseCost: number
          inputs?: typeof gather.inputs
          vendorValue: number
          marketPrice: number
        } = {
          name: gather.name,
          timeSeconds: gather.timeSeconds,
          baseCost: gather.baseCost,
          vendorValue: gather.vendorValue,
          marketPrice: gather.marketPrice,
        }
        // Only include inputs if they exist
        if (gather.inputs && gather.inputs.length > 0) {
          exported.inputs = gather.inputs
        }
        return exported
      }),
      magicFindDefaults: magicFindDefaults.value,
      marketTaxRate: marketTaxRate.value,
      resourceRecipes: resourceRecipes.value.map((recipe) => ({
        name: recipe.name,
        timeSeconds: recipe.timeSeconds,
        skill: recipe.skill,
        materials: recipe.materials.map((mat) => ({
          name: mat.name,
          quantity: mat.quantity,
        })),
        currentPrice: recipe.currentPrice,
        vendorValue: recipe.vendorValue,
        hashedId: recipe.hashedId,
      })),
      efficiencyItems: efficiencyItems.value.map((item) => ({
        name: item.name,
        hashedId: item.hashedId,
        effects: item.effects.map((effect) => ({
          skill: effect.skill,
          efficiencyPercent: effect.efficiencyPercent,
        })),
      })),
    }

    // Return pretty-printed JSON with 2-space indentation
    return JSON.stringify(exportData, null, 2)
  }

  /**
   * Map of resource names to their skills (for efficiency application)
   * This includes all 3 gather modes (Buy All, Gather Except Coal, Gather All)
   * and raw gathering entries (ores, fish, logs)
   */
  const resourceSkillMap = computed(() => {
    const map = new Map<string, ResourceRecipe['skill']>()

    for (const recipe of resourceRecipes.value) {
      // All 3 modes use the same skill
      map.set(recipe.name, recipe.skill)
      map.set(`${recipe.name} (gather)`, recipe.skill)
      map.set(`${recipe.name} (gather all)`, recipe.skill)
    }

    // Include raw gathering entries (ores, fish, logs) with their skill
    for (const gather of defaults.value.resourceGathering) {
      if (gather.skill) {
        map.set(gather.name, gather.skill)
      }
    }

    return map
  })

  return {
    // Reactive data
    materials,
    craftables,
    resources,
    recipes,
    dungeons,
    craftableRecipes,
    resourceRecipes,
    resourceGathering,
    magicFindDefaults,
    marketTaxRate,
    allItems,
    efficiencyItems,

    // Price lookup maps
    materialPriceMap,
    craftablePriceMap,
    resourcePriceMap,
    materialLastSaleAtMap,
    materialVendorValueMap,
    resourceSkillMap,

    // Update methods
    updateMaterialPrice,
    updateCraftablePrice,
    updateResourcePrice,
    updateRecipe,
    updateHashedId,
    updateVendorValue,
    updateLastSaleAt,

    // Clear methods
    clearCategoryOverrides,
    clearAllOverrides,

    // Utility methods
    hasOverride,
    importFromApiCache,
    reloadOverrides,
    getOverrideStats,

    // Refresh exclusion methods
    setRefreshExcluded,
    isRefreshExcluded,
    setAllRefreshExcluded,
    getExclusionStats,

    // Export methods
    exportAsDefaultsJson,

    // Craftable methods
    addCraftableRecipe,
    updateCraftableRecipeTime,
    removeCraftableRecipe,
    addMaterial,
    addCraftable,
    updateRecipeDefaults,

    // Resource recipe methods
    addResourceRecipe,
    updateResourceRecipeTime,
    removeResourceRecipe,
  }
}

/**
 * Data provider composable (singleton)
 *
 * Returns the same reactive data instance on every call.
 * This ensures all components share the same reactive state.
 */
export function useDataProvider() {
  if (!dataProviderInstance) {
    dataProviderInstance = createDataProvider()
  }
  return dataProviderInstance
}
