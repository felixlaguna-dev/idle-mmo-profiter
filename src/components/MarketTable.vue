<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDataProvider } from '../composables/useDataProvider'
import { useMarketRefresh } from '../composables/useMarketRefresh'
import { useStaticMode } from '../composables/useStaticMode'
import { storageManager } from '../storage/persistence'
import { useToast } from '../composables/useToast'
import EditableValue from './EditableValue.vue'
import HashedIdModal from './HashedIdModal.vue'
import type { RefreshCategory } from '../composables/useMarketRefresh'

const { isStaticMode } = useStaticMode()

// Vendor-sold items (vials, crystals) with their buy prices from NPC shops.
// These items are not tradable on the market, so we use known buy prices.
const VENDOR_BUY_PRICES: Record<string, number> = {
  '3Zbym56qLx61NBRp7Eek': 5, // Cheap Vial
  BRn3x72JQ2OrNzOMok41: 5, // Cheap Crystal
  oZwey82VNAnPYD0dXM3g: 10, // Tarnished Vial
  gGZ2J71yYKwxYMmjbown: 10, // Tarnished Crystal
  JZdg5V3PQoXyNEyWq0zl: 50, // Gleaming Vial
  yav4OK1wNEyWNZP7rzJb: 50, // Gleaming Crystal
  JVM29l7kQZ0mY80q6WDG: 200, // Elemental Vial
  oaJydnOmQWV9LbgRe5ME: 200, // Elemental Crystal
  '93R0qXalLl9xQAbn8DBg': 500, // Eldritch Vial
  ZqEegBydNwAmLkA59J61: 500, // Eldritch Crystal
  '1rZXlwg5YvVkYk9joDmG': 2500, // Arcane Vial
  '3Zbym56qLxZENBRp7Eek': 2500, // Arcane Crystal
}

const dataProvider = useDataProvider()
const marketRefresh = useMarketRefresh()
const { showToast } = useToast()

// Check if API key is configured
const hasApiKey = computed(() => {
  const settings = storageManager.getSettings()
  return settings.apiKey !== null && settings.apiKey !== ''
})

// Count of untracked craftables (for Track All button)
const untrackedCraftableCount = computed(() => {
  return dataProvider.recipes.value.filter(
    (r) => isUntrackedCraftableRecipe(r.name, r.producesItemName) && r.hashedId
  ).length
})

// Search state
const searchQuery = ref('')

// Section collapse state
const sectionsExpanded = ref({
  materials: true,
  craftables: false,
  resources: false,
  recipes: false,
})

// Sort state
type SortField = 'name' | 'vendor' | 'market' | 'spread'
type SortDir = 'asc' | 'desc'
const sortField = ref<SortField>('spread')
const sortDir = ref<SortDir>('desc')

const toggleSort = (field: SortField) => {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = field === 'name' ? 'asc' : 'desc'
  }
}

const getSortIcon = (field: SortField): string => {
  if (sortField.value !== field) return '↕'
  return sortDir.value === 'asc' ? '↑' : '↓'
}

// Compute spread percentage for an item
const getSpreadPercent = (marketPrice: number, vendorValue?: number): number => {
  if (!vendorValue || vendorValue <= 0 || marketPrice <= 0) return 0
  return ((marketPrice - vendorValue) / vendorValue) * 100
}

// Format spread for display
const formatSpread = (marketPrice: number, vendorValue?: number): string => {
  if (!vendorValue || vendorValue <= 0 || marketPrice <= 0) return '—'
  const pct = getSpreadPercent(marketPrice, vendorValue)
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

// Get spread color class
const getSpreadColorClass = (marketPrice: number, vendorValue?: number): string => {
  const pct = getSpreadPercent(marketPrice, vendorValue)
  if (pct <= 0) return 'spread-negative'
  if (pct >= 900) return 'spread-extreme'
  if (pct >= 200) return 'spread-high'
  if (pct >= 50) return 'spread-moderate'
  return 'spread-low'
}

// Generic sort function for market items
function sortItems<T>(items: T[], getVendor: (i: T) => number | undefined, getMarket: (i: T) => number, getName: (i: T) => string): T[] {
  return [...items].sort((a, b) => {
    let cmp = 0
    switch (sortField.value) {
      case 'name':
        cmp = getName(a).localeCompare(getName(b))
        break
      case 'vendor':
        cmp = (getVendor(a) ?? 0) - (getVendor(b) ?? 0)
        break
      case 'market':
        cmp = getMarket(a) - getMarket(b)
        break
      case 'spread':
        cmp = getSpreadPercent(getMarket(a), getVendor(a)) - getSpreadPercent(getMarket(b), getVendor(b))
        break
    }
    return sortDir.value === 'asc' ? cmp : -cmp
  })
}

// Sorted & filtered arrays
const sortedMaterials = computed(() => sortItems(
  filteredMaterials.value,
  (m) => m.vendorValue,
  (m) => m.price,
  (m) => m.name,
))

const sortedCraftables = computed(() => sortItems(
  filteredCraftables.value,
  (c) => c.vendorValue,
  (c) => c.price,
  (c) => c.name,
))

const sortedResources = computed(() => sortItems(
  filteredResources.value,
  (r) => r.vendorValue,
  (r) => r.marketPrice,
  (r) => r.name,
))

const sortedRecipes = computed(() => sortItems(
  filteredRecipes.value,
  (r) => r.vendorValue,
  (r) => r.price,
  (r) => r.name,
))

// Mobile display limit — show 20 items per section initially on mobile
const MOBILE_INITIAL_LIMIT = 20
const isMobileView = ref(false)
const showAllMaterials = ref(false)
const showAllCraftables = ref(false)
const showAllResources = ref(false)
const showAllRecipes = ref(false)

// eslint-disable-next-line no-undef
let mediaQuery: MediaQueryList | null = null
const onMediaChange = (e: { matches: boolean }) => {
  isMobileView.value = e.matches
}
onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 767px)')
  isMobileView.value = mediaQuery.matches
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mediaQuery.addEventListener('change', onMediaChange as any)
})
onUnmounted(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mediaQuery?.removeEventListener('change', onMediaChange as any)
})

const displayMaterials = computed(() => {
  const items = sortedMaterials.value
  if (!isMobileView.value || showAllMaterials.value || items.length <= MOBILE_INITIAL_LIMIT) return items
  return items.slice(0, MOBILE_INITIAL_LIMIT)
})

const displayCraftables = computed(() => {
  const items = sortedCraftables.value
  if (!isMobileView.value || showAllCraftables.value || items.length <= MOBILE_INITIAL_LIMIT) return items
  return items.slice(0, MOBILE_INITIAL_LIMIT)
})

const displayResources = computed(() => {
  const items = sortedResources.value
  if (!isMobileView.value || showAllResources.value || items.length <= MOBILE_INITIAL_LIMIT) return items
  return items.slice(0, MOBILE_INITIAL_LIMIT)
})

const displayRecipes = computed(() => {
  const items = sortedRecipes.value
  if (!isMobileView.value || showAllRecipes.value || items.length <= MOBILE_INITIAL_LIMIT) return items
  return items.slice(0, MOBILE_INITIAL_LIMIT)
})

// Per-item refresh loading state
const itemRefreshLoading = ref<Record<string, boolean>>({})

// Show refresh estimate modal
const showRefreshEstimate = ref(false)

// Hashed ID modal state
const hashedIdModalVisible = ref(false)
const hashedIdModalItem = ref<{
  itemName: string
  itemId: string
  category: 'materials' | 'craftables' | 'resources' | 'recipes'
  currentHashedId: string
} | null>(null)

// Get default values for reset functionality
const getDefaultMaterialPrice = (id: string): number => {
  const item = dataProvider.materials.value.find((m) => m.id === id)
  return item?.price ?? 0
}

const getDefaultCraftablePrice = (id: string): number => {
  const item = dataProvider.craftables.value.find((p) => p.id === id)
  return item?.price ?? 0
}

const getDefaultResourcePrice = (id: string): number => {
  const item = dataProvider.resources.value.find((r) => r.id === id)
  return item?.marketPrice ?? 0
}

const getDefaultRecipePrice = (id: string): number => {
  const item = dataProvider.recipes.value.find((r) => r.id === id)
  return item?.price ?? 0
}

// Filtered data based on search query
const filteredMaterials = computed(() => {
  if (!searchQuery.value) return dataProvider.materials.value
  const query = searchQuery.value.toLowerCase()
  return dataProvider.materials.value.filter((m) => m.name.toLowerCase().includes(query))
})

const filteredCraftables = computed(() => {
  if (!searchQuery.value) return dataProvider.craftables.value
  const query = searchQuery.value.toLowerCase()
  return dataProvider.craftables.value.filter((p) => p.name.toLowerCase().includes(query))
})

const filteredResources = computed(() => {
  if (!searchQuery.value) return dataProvider.resources.value
  const query = searchQuery.value.toLowerCase()
  return dataProvider.resources.value.filter((r) => r.name.toLowerCase().includes(query))
})

const filteredRecipes = computed(() => {
  if (!searchQuery.value) return dataProvider.recipes.value
  const query = searchQuery.value.toLowerCase()
  return dataProvider.recipes.value.filter((r) => r.name.toLowerCase().includes(query))
})

// Has results
const hasResults = computed(() => {
  return (
    filteredMaterials.value.length > 0 ||
    filteredCraftables.value.length > 0 ||
    filteredResources.value.length > 0 ||
    filteredRecipes.value.length > 0
  )
})

// Toggle section
const toggleSection = (section: keyof typeof sectionsExpanded.value) => {
  sectionsExpanded.value[section] = !sectionsExpanded.value[section]
}

// Reset handlers
const resetMaterialsToDefaults = () => {
  if (
    confirm(
      'Reset all material prices to default values? This will clear all your custom prices for materials.'
    )
  ) {
    dataProvider.clearCategoryOverrides('materials')
  }
}

const resetCraftablesToDefaults = () => {
  if (
    confirm(
      'Reset all craftable prices to default values? This will clear all your custom prices for craftables.'
    )
  ) {
    dataProvider.clearCategoryOverrides('craftables')
  }
}

const resetResourcesToDefaults = () => {
  if (
    confirm(
      'Reset all resource prices to default values? This will clear all your custom prices for resources.'
    )
  ) {
    dataProvider.clearCategoryOverrides('resources')
  }
}

const resetRecipesToDefaults = () => {
  if (
    confirm(
      'Reset all recipe prices to default values? This will clear all your custom prices for recipes.'
    )
  ) {
    dataProvider.clearCategoryOverrides('recipes')
  }
}

const resetAllToDefaults = () => {
  if (
    confirm(
      'Reset ALL market data to default values? This will clear all your custom overrides for materials, craftables, resources, and recipes.'
    )
  ) {
    dataProvider.clearAllOverrides()
  }
}

// Update handlers
const updateMaterialPrice = (id: string, price: number) => {
  dataProvider.updateMaterialPrice(id, price)
}

const updateCraftablePrice = (id: string, price: number) => {
  dataProvider.updateCraftablePrice(id, price)
}

const updateResourcePrice = (id: string, marketPrice: number) => {
  dataProvider.updateResourcePrice(id, marketPrice)
}

const updateRecipePrice = (id: string, price: number) => {
  dataProvider.updateRecipe(id, { price })
}

// Get override stats
const overrideStats = computed(() => dataProvider.getOverrideStats())

// Get exclusion stats
const exclusionStats = computed(() => dataProvider.getExclusionStats())

// Refresh estimate
const refreshEstimate = computed(() => marketRefresh.getRefreshEstimate())

// Format minutes for display
const formatMinutes = (minutes: number): string => {
  if (minutes < 1) return 'less than 1 min'
  if (minutes === 1) return '1 min'
  return `~${minutes} min`
}

// Start refresh all
const startRefreshAll = () => {
  if (!hasApiKey.value) {
    showToast('API key required to refresh prices', 'error')
    return
  }

  showRefreshEstimate.value = false

  // Start the refresh with progress callback
  marketRefresh
    .refreshAllItems({
      onProgress: () => {
        // Progress is tracked reactively via marketRefresh.refreshProgress
      },
    })
    .then(() => {
      const errors = marketRefresh.refreshErrors.value
      const successCount = marketRefresh.refreshProgress.value.current - errors.length
      const skippedCount = marketRefresh.refreshProgress.value.skippedCount

      if (errors.length === 0) {
        showToast(
          `Refreshed ${successCount} items successfully! ${skippedCount} items skipped (excluded).`,
          'success'
        )
      } else {
        showToast(
          `Refreshed ${successCount} items with ${errors.length} errors. ${skippedCount} items skipped (excluded).`,
          'warning'
        )
      }
    })
    .catch((error) => {
      showToast(`Refresh failed: ${error.message}`, 'error')
    })
}

// Cancel refresh
const cancelRefresh = () => {
  marketRefresh.cancelRefresh()
  showToast('Refresh cancelled', 'info')
}

// Refresh single item
const refreshItem = async (category: RefreshCategory, itemId: string) => {
  if (!hasApiKey.value) {
    showToast('API key required to refresh prices', 'error')
    return
  }

  const key = `${category}-${itemId}`
  itemRefreshLoading.value[key] = true

  try {
    const result = await marketRefresh.refreshItemPrice(category, itemId)

    if (result.success) {
      showToast(`Updated ${result.itemName}: ${result.newPrice} gold`, 'success')
    } else {
      showToast(`Failed to refresh ${result.itemName}: ${result.error}`, 'error')
    }
  } catch (error) {
    showToast(
      `Error refreshing item: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  } finally {
    itemRefreshLoading.value[key] = false
  }
}

// Toggle exclusion for single item
const toggleExclusion = (category: RefreshCategory, itemId: string) => {
  const currentState = dataProvider.isRefreshExcluded(category, itemId)
  dataProvider.setRefreshExcluded(category, itemId, !currentState)
}

// Toggle exclusion for entire category
const toggleCategoryExclusion = (category: RefreshCategory) => {
  const stats = dataProvider.getExclusionStats(category)
  const allExcluded = stats.excluded === stats.total

  // If all excluded, include all. Otherwise, exclude all.
  dataProvider.setAllRefreshExcluded(category, !allExcluded)
}

// Get three-state checkbox state for category
const getCategoryExclusionState = (category: RefreshCategory): 'all' | 'none' | 'mixed' => {
  const stats = dataProvider.getExclusionStats(category)

  if (stats.excluded === 0) return 'none'
  if (stats.excluded === stats.total) return 'all'
  return 'mixed'
}

// Check if a recipe produces a craftable that's not yet tracked
const isUntrackedCraftableRecipe = (recipeName: string, producesItemName?: string): boolean => {
  // Determine what craftable this recipe produces
  const craftableName = producesItemName || inferCraftableName(recipeName)
  if (!craftableName) return false

  // If producesItemName is not set AND the recipe name doesn't contain "Recipe",
  // this is likely not a craftable recipe (could be fishing loot, equipment, etc.)
  if (!producesItemName && !recipeName.toLowerCase().includes('recipe')) {
    return false
  }

  // Check if the craftable is already tracked
  const isTracked = dataProvider.craftableRecipes.value.some(
    (craft) => craft.name === craftableName
  )

  return !isTracked
}

// Infer craftable name from recipe name by stripping "Recipe" and "(Untradable)" suffixes
const inferCraftableName = (recipeName: string): string | null => {
  const cleaned = recipeName
    .replace(/\s*\(Untradable\)\s*/i, '')
    .replace(/\s*Recipe\s*$/i, '')
    .trim()
  return cleaned || null
}

// Get default crafting time in seconds based on recipe level
const getCraftTimeForLevel = (level: number): number => {
  if (level <= 6) return 132.7
  if (level <= 17) return 309.7
  if (level <= 25) return 584.1
  if (level <= 52) return 796.5
  if (level <= 85) return 1061.9
  return 1327.4
}

// Loading state for adding recipes
const addRecipeLoading = ref<Record<string, boolean>>({})

// Loading state for refreshing item data
const refreshItemDataLoading = ref(false)

// Market value spread class based on vendor-to-market ratio
const getSpreadClass = (marketPrice: number, vendorValue?: number): string => {
  if (!vendorValue || vendorValue <= 0 || marketPrice <= 0) return ''
  const ratio = marketPrice / vendorValue
  if (ratio >= 10) return 'spread-extreme'
  if (ratio >= 3) return 'spread-high'
  if (ratio >= 1.5) return 'spread-moderate'
  return ''
}

// Track All Untracked Craftables state
const trackAllLoading = ref(false)
const trackAllProgress = ref({ current: 0, total: 0 })
const trackAllAborted = ref(false)

// Add an untracked craftable recipe
// Recursively adds missing materials and fetches market prices from the API
// Returns true on success, false on failure
const addUntrackedCraftable = async (
  recipe: {
    id: string
    name: string
    hashedId?: string
    producesItemName?: string
  },
  silent = false
): Promise<boolean> => {
  const craftableName = recipe.producesItemName || inferCraftableName(recipe.name)
  if (!craftableName) {
    if (!silent) {
      showToast('Cannot determine which craftable this recipe produces.', 'error')
    }
    return false
  }

  if (!recipe.hashedId) {
    if (!silent) {
      showToast('Recipe is missing a hashed ID. Please set it first.', 'error')
    }
    return false
  }

  // Set loading state
  addRecipeLoading.value[recipe.id] = true

  try {
    const { inspectItem, searchItems, getAverageMarketPrice } = await import('../api/services')

    // Step 1: Inspect the recipe item to get materials and crafting info
    const recipeDetails = await inspectItem(recipe.hashedId)

    if (!recipeDetails?.recipe) {
      if (!silent) {
        showToast(
          `No recipe details found for "${recipe.name}". Check the browser console.`,
          'error'
        )
      }
      console.error(
        `[AddCraftable] No recipe data for "${recipe.name}" (type: ${recipeDetails?.type || 'unknown'}). Full response:`,
        JSON.stringify(recipeDetails, null, 2)
      )
      return false
    }

    const recipeData = recipeDetails.recipe

    // Step 2: For each material, ensure it exists in data with a market price
    const materials: Array<{ name: string; quantity: number; unitCost: number }> = []

    for (const mat of recipeData.materials) {
      let material = dataProvider.materials.value.find((m) => m.name === mat.item_name)

      if (!material) {
        // Material doesn't exist — add it with hashed ID from the recipe, fetch its market price
        console.log(`[AddCraftable] Material "${mat.item_name}" not found, fetching from API...`)

        let price = 0
        let vendorValue = 0
        if (mat.hashed_item_id) {
          // Check if this is a known vendor item (vials, crystals) with a fixed buy price
          const vendorBuyPrice = VENDOR_BUY_PRICES[mat.hashed_item_id]
          if (vendorBuyPrice) {
            price = vendorBuyPrice
            vendorValue = vendorBuyPrice
            console.log(
              `[AddCraftable] Using known vendor buy price for "${mat.item_name}": ${price}`
            )
          } else {
            const avgPrice = await getAverageMarketPrice(mat.hashed_item_id)
            price = avgPrice ?? 0
            console.log(`[AddCraftable] Fetched market price for "${mat.item_name}": ${price}`)
          }
        }

        dataProvider.addMaterial({
          name: mat.item_name,
          price,
          hashedId: mat.hashed_item_id || '',
          vendorValue,
        })
        material = { id: '', name: mat.item_name, price, hashedId: mat.hashed_item_id }
      } else if (material.price === 0 && material.hashedId) {
        // Material exists but has no price — check vendor buy prices first, then market
        console.log(`[AddCraftable] Material "${material.name}" has price 0, fetching...`)
        const vendorBuyPrice = VENDOR_BUY_PRICES[material.hashedId]
        if (vendorBuyPrice) {
          dataProvider.updateMaterialPrice(material.id, vendorBuyPrice)
          material = { ...material, price: vendorBuyPrice }
          console.log(
            `[AddCraftable] Using known vendor buy price for "${material.name}": ${vendorBuyPrice}`
          )
        } else {
          const avgPrice = await getAverageMarketPrice(material.hashedId)
          if (avgPrice && avgPrice > 0) {
            dataProvider.updateMaterialPrice(material.id, avgPrice)
            material = { ...material, price: avgPrice }
            console.log(`[AddCraftable] Updated market price for "${material.name}": ${avgPrice}`)
          }
        }
      }

      materials.push({
        name: mat.item_name,
        quantity: mat.quantity,
        unitCost: material.price,
      })
    }

    // Step 3: Get or fetch the craftable's market price
    // Use the result item from the recipe if available
    let craftablePrice = 0
    const existingCraftable = dataProvider.craftables.value.find((p) => p.name === craftableName)

    if (existingCraftable) {
      craftablePrice = existingCraftable.price
    } else {
      // Craftable not in data — use recipe result hashed ID or search by name
      const craftableHashedId = recipeData.result?.hashed_item_id
      console.log(`[AddCraftable] Craftable "${craftableName}" not in data, fetching price...`)

      if (craftableHashedId) {
        const avgPrice = await getAverageMarketPrice(craftableHashedId)
        craftablePrice = avgPrice ?? 0
        console.log(
          `[AddCraftable] Fetched craftable price for "${craftableName}": ${craftablePrice}`
        )

        dataProvider.addCraftable({
          name: craftableName,
          price: craftablePrice,
          hashedId: craftableHashedId,
        })
      } else {
        // Fallback: search by name
        const searchResult = await searchItems(craftableName)
        const craftableItem =
          searchResult.items.find(
            (item) => item.name.toLowerCase() === craftableName.toLowerCase()
          ) || searchResult.items[0]

        if (craftableItem) {
          const avgPrice = await getAverageMarketPrice(craftableItem.hashed_id)
          craftablePrice = avgPrice ?? 0

          dataProvider.addCraftable({
            name: craftableName,
            price: craftablePrice,
            hashedId: craftableItem.hashed_id,
            vendorValue: craftableItem.vendor_price ?? 0,
          })
        }
      }
    }

    // Step 4: Update this recipe and its counterpart with uses and producesItemName
    const maxUses = recipeData.max_uses ?? undefined
    const recipeUpdate = {
      producesItemName: craftableName,
      ...(maxUses !== undefined && maxUses !== null ? { uses: maxUses } : {}),
    }

    // Update the clicked recipe
    dataProvider.updateRecipeDefaults(recipe.id, recipeUpdate)

    // Find and update the counterpart (tradable↔untradable)
    const baseName = recipe.name.replace(/\s*\(Untradable\)\s*/i, '')
    const counterparts = dataProvider.recipes.value.filter(
      (r) => r.id !== recipe.id && r.name.replace(/\s*\(Untradable\)\s*/i, '') === baseName
    )
    for (const counterpart of counterparts) {
      dataProvider.updateRecipeDefaults(counterpart.id, recipeUpdate)
    }

    console.log(
      `[AddCraftable] Updated recipe "${recipe.name}" and ${counterparts.length} counterpart(s) with uses=${maxUses}, producesItemName="${craftableName}"`
    )

    // Step 5: Create the CraftableRecipe entry
    const craftTime = getCraftTimeForLevel(recipeData.level_required)
    const skill: 'alchemy' | 'forging' | undefined =
      recipeData.skill === 'alchemy'
        ? 'alchemy'
        : recipeData.skill === 'forging'
          ? 'forging'
          : undefined
    const craftableRecipe = {
      name: craftableName,
      timeSeconds: craftTime,
      materials,
      currentPrice: craftablePrice,
      skill,
    }

    dataProvider.addCraftableRecipe(craftableRecipe)

    if (!silent) {
      showToast(
        `Added "${craftableName}" with ${materials.length} materials! Check the Craftables tab.`,
        'success'
      )
    }
    return true
  } catch (error) {
    console.error('Failed to add craftable:', error)
    if (!silent) {
      showToast('Failed to add craftable. Check browser console for details.', 'error')
    }
    return false
  } finally {
    addRecipeLoading.value[recipe.id] = false
  }
}

// Track all untracked craftable recipes at once
const trackAllUntrackedCraftables = async () => {
  // Check API key
  if (!hasApiKey.value) {
    showToast('API key required to track craftables.', 'error')
    return
  }

  // Filter to untracked recipes with hashedId
  const untrackedRecipes = dataProvider.recipes.value.filter(
    (r) => isUntrackedCraftableRecipe(r.name, r.producesItemName) && r.hashedId
  )

  if (untrackedRecipes.length === 0) {
    showToast('No untracked craftables found.', 'info')
    return
  }

  // Initialize progress tracking
  trackAllLoading.value = true
  trackAllAborted.value = false
  trackAllProgress.value = { current: 0, total: untrackedRecipes.length }

  let successCount = 0
  let failCount = 0
  let skipCount = 0

  // Process recipes sequentially to respect API rate limits
  for (const recipe of untrackedRecipes) {
    // Check for cancellation
    if (trackAllAborted.value) {
      showToast(`Cancelled. Tracked ${successCount} craftables.`, 'info')
      trackAllLoading.value = false
      return
    }

    trackAllProgress.value.current++

    // Re-check: recipe may have been tracked by a sibling variant (tradable/untradable)
    if (!isUntrackedCraftableRecipe(recipe.name, recipe.producesItemName)) {
      skipCount++
      continue
    }

    // Call with silent=true to suppress individual toasts during bulk operations
    const success = await addUntrackedCraftable(recipe, true)
    if (success) {
      successCount++
    } else {
      failCount++
    }
  }

  // Show summary
  const parts = [`Tracked ${successCount} craftables`]
  if (skipCount > 0) parts.push(`${skipCount} skipped as duplicates`)
  if (failCount > 0) parts.push(`${failCount} failed`)

  showToast(`${parts.join(', ')}.`, failCount > 0 ? 'warning' : 'success')

  // Reset state
  trackAllLoading.value = false
}

// Cancel the Track All operation
const cancelTrackAll = () => {
  trackAllAborted.value = true
}

// Hashed ID modal functions
const openHashedIdModal = (
  category: 'materials' | 'craftables' | 'resources' | 'recipes',
  item: { id: string; name: string; hashedId?: string }
) => {
  hashedIdModalItem.value = {
    itemName: item.name,
    itemId: item.id,
    category,
    currentHashedId: item.hashedId || '',
  }
  hashedIdModalVisible.value = true
}

const saveHashedId = (newHashedId: string) => {
  if (!hashedIdModalItem.value) return

  const { category, itemId, itemName, currentHashedId } = hashedIdModalItem.value

  // Update via dataProvider
  dataProvider.updateHashedId(category, itemId, newHashedId)

  // Show toast notification
  if (newHashedId === '' && currentHashedId === '') {
    // No-op: both empty, don't show toast (this shouldn't happen due to modal logic)
    return
  } else if (newHashedId === '') {
    showToast(`Cleared hashed ID for ${itemName}`, 'info')
  } else {
    showToast(`Updated hashed ID for ${itemName}`, 'success')
  }
}

const refreshItemData = async () => {
  if (!hashedIdModalItem.value) return

  const { category, itemId, itemName, currentHashedId } = hashedIdModalItem.value

  if (!currentHashedId) {
    showToast('No hashed ID set for this item', 'error')
    return
  }

  refreshItemDataLoading.value = true

  try {
    const { inspectItem } = await import('../api/services')
    const { generateCacheKey, invalidate } = await import('../api/cache')

    // Invalidate cache to ensure fresh data
    const cacheKey = generateCacheKey(`/item/${currentHashedId}/inspect`)
    invalidate(cacheKey)

    // Fetch item details
    const itemDetails = await inspectItem(currentHashedId)

    if (!itemDetails) {
      showToast(`Failed to fetch data for ${itemName}`, 'error')
      return
    }

    // Update vendor value for ALL categories
    if (itemDetails.vendor_price !== undefined && itemDetails.vendor_price !== null) {
      dataProvider.updateVendorValue(category, itemId, itemDetails.vendor_price)
    }

    // Update recipe-specific fields if this item has recipe data
    if (itemDetails.recipe && category === 'recipes') {
      const recipeUpdate: {
        uses?: number
        producesItemName?: string
        producesItemHashedId?: string
      } = {}

      // Extract max_uses
      if (itemDetails.recipe.max_uses !== undefined && itemDetails.recipe.max_uses !== null) {
        recipeUpdate.uses = itemDetails.recipe.max_uses
      }

      // Extract producesItemName and producesItemHashedId
      if (itemDetails.recipe.result) {
        if (itemDetails.recipe.result.item_name) {
          recipeUpdate.producesItemName = itemDetails.recipe.result.item_name
        }
        if (itemDetails.recipe.result.hashed_item_id) {
          recipeUpdate.producesItemHashedId = itemDetails.recipe.result.hashed_item_id
        }
      }

      // Update the current recipe
      dataProvider.updateRecipeDefaults(itemId, recipeUpdate)

      // Find and update the counterpart (tradable ↔ untradable)
      const recipe = dataProvider.recipes.value.find((r) => r.id === itemId)
      if (recipe) {
        const baseName = recipe.name.replace(/\s*\(Untradable\)\s*/i, '')
        const counterparts = dataProvider.recipes.value.filter(
          (r) => r.id !== itemId && r.name.replace(/\s*\(Untradable\)\s*/i, '') === baseName
        )
        for (const counterpart of counterparts) {
          dataProvider.updateRecipeDefaults(counterpart.id, recipeUpdate)
        }

        console.log(
          `[RefreshItemData] Updated recipe "${recipe.name}" and ${counterparts.length} counterpart(s) with uses=${recipeUpdate.uses ?? 'unchanged'}, producesItemName="${recipeUpdate.producesItemName ?? 'unchanged'}"`
        )
      }

      showToast(`Updated ${itemName} with fresh data from API`, 'success')
    } else {
      // Non-recipe item or recipe with no recipe data
      showToast(`Updated vendor value for ${itemName}`, 'success')
    }
  } catch (error) {
    console.error('[RefreshItemData] Failed to refresh item data:', error)
    showToast(
      `Failed to refresh ${itemName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'error'
    )
  } finally {
    refreshItemDataLoading.value = false
  }
}
</script>

<template>
  <div class="market-table">
    <!-- Market Summary -->
    <div class="market-summary">
      {{ filteredMaterials.length + filteredCraftables.length + filteredResources.length + filteredRecipes.length }} items across 4 categories
    </div>

    <!-- Search Bar -->
    <div class="search-bar-container">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <svg class="search-icon" viewBox="0 0 20 20" fill="currentColor" width="18" height="18">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search items..."
            autocomplete="off"
          />
        </div>
        <div class="search-stats">
          <span v-if="searchQuery" class="search-count">
            {{
              filteredMaterials.length +
              filteredCraftables.length +
              filteredResources.length +
              filteredRecipes.length
            }}
            results
          </span>
          <span
            v-if="!isStaticMode"
            class="override-count"
            :class="{ active: overrideStats.total > 0 }"
          >
            {{ overrideStats.total }} overrides
          </span>
          <span
            v-if="!isStaticMode"
            class="exclusion-count"
            :class="{ active: (exclusionStats.totalExcluded ?? 0) > 0 }"
          >
            {{ exclusionStats.totalExcluded ?? 0 }} excluded
          </span>
        </div>
      </div>
      <button
        v-if="!isStaticMode"
        class="btn-refresh-all"
        :disabled="!hasApiKey || marketRefresh.isRefreshing.value"
        :title="hasApiKey ? 'Refresh all market prices from API' : 'API key required'"
        @click="showRefreshEstimate = true"
      >
        <svg
          v-if="!marketRefresh.isRefreshing.value"
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="23 4 23 10 17 10"></polyline>
          <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
        </svg>
        <span v-if="marketRefresh.isRefreshing.value" class="spinner"></span>
        {{ marketRefresh.isRefreshing.value ? 'Refreshing...' : 'Refresh All Prices' }}
      </button>
      <button
        v-if="!isStaticMode"
        class="btn-reset-all"
        title="Reset all to defaults"
        @click="resetAllToDefaults"
      >
        Reset All
      </button>
    </div>

    <!-- Refresh Progress Bar -->
    <div v-if="marketRefresh.isRefreshing.value && !isStaticMode" class="refresh-progress-container">
      <div class="refresh-progress-header">
        <div class="refresh-progress-text">
          <span class="refresh-progress-current">{{
            marketRefresh.refreshProgress.value.currentItem
          }}</span>
          <span class="refresh-progress-count">
            {{ marketRefresh.refreshProgress.value.current }} /
            {{ marketRefresh.refreshProgress.value.totalIncluded }} ({{
              marketRefresh.refreshProgress.value.skippedCount
            }}
            skipped)
          </span>
        </div>
        <button class="btn-cancel-refresh" @click="cancelRefresh">Cancel</button>
      </div>
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{
            width:
              marketRefresh.refreshProgress.value.totalIncluded > 0
                ? `${(marketRefresh.refreshProgress.value.current / marketRefresh.refreshProgress.value.totalIncluded) * 100}%`
                : '0%',
          }"
        ></div>
      </div>
    </div>

    <!-- Refresh Estimate Modal -->
    <div
      v-if="showRefreshEstimate && !isStaticMode"
      class="modal-overlay"
      @click.self="showRefreshEstimate = false"
    >
      <div class="modal-content-small">
        <div class="modal-header-small">
          <h3>Refresh All Market Prices</h3>
          <button class="btn-close-modal" @click="showRefreshEstimate = false">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <div class="modal-body">
          <p class="estimate-text">
            This will refresh
            <strong
              >{{ refreshEstimate.includedItems }} of {{ refreshEstimate.totalItems }} items</strong
            >
            from the API.
          </p>
          <p v-if="refreshEstimate.excludedItems > 0" class="estimate-excluded">
            {{ refreshEstimate.excludedItems }} items are excluded and will be skipped.
          </p>
          <p class="estimate-time">
            Estimated time: <strong>{{ formatMinutes(refreshEstimate.estimatedMinutes) }}</strong>
          </p>
          <div class="modal-actions">
            <button class="btn-confirm" @click="startRefreshAll">Start Refresh</button>
            <button class="btn-cancel-modal" @click="showRefreshEstimate = false">Cancel</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Hashed ID Modal -->
    <HashedIdModal
      v-if="hashedIdModalItem && !isStaticMode"
      v-model:visible="hashedIdModalVisible"
      :item-name="hashedIdModalItem.itemName"
      :item-id="hashedIdModalItem.itemId"
      :category="hashedIdModalItem.category"
      :current-hashed-id="hashedIdModalItem.currentHashedId"
      :refreshing="refreshItemDataLoading"
      @save="saveHashedId"
      @refresh="refreshItemData"
    />

    <!-- Empty State -->
    <div v-if="!hasResults" class="empty-state">
      <div class="empty-icon">🔍</div>
      <h3>No items match your search</h3>
      <p>Try a different search term or clear your search to see all items.</p>
    </div>

    <!-- Materials Section -->
    <section
      v-if="filteredMaterials.length > 0"
      class="market-section"
      :class="{ collapsed: !sectionsExpanded.materials }"
    >
      <div class="section-header" @click="toggleSection('materials')">
        <div class="section-title">
          <svg class="expand-icon" :class="{ expanded: sectionsExpanded.materials }" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
          <h2>Materials</h2>
          <span class="item-count">{{ filteredMaterials.length }} items</span>
          <span v-if="overrideStats.materials > 0 && !isStaticMode" class="override-badge">
            {{ overrideStats.materials }} overridden
          </span>
          <span
            v-if="(dataProvider.getExclusionStats('materials')?.excluded ?? 0) > 0 && !isStaticMode"
            class="exclusion-badge"
          >
            {{ dataProvider.getExclusionStats('materials')?.excluded ?? 0 }} excluded
          </span>
        </div>
        <div v-if="!isStaticMode" class="section-actions">
          <button
            class="btn-toggle-exclusion"
            :title="
              getCategoryExclusionState('materials') === 'all'
                ? 'Include all materials in refresh'
                : 'Exclude all materials from refresh'
            "
            @click.stop="toggleCategoryExclusion('materials')"
          >
            <span v-if="getCategoryExclusionState('materials') === 'all'">☑</span>
            <span v-else-if="getCategoryExclusionState('materials') === 'mixed'">▣</span>
            <span v-else>☐</span>
            {{ getCategoryExclusionState('materials') === 'all' ? 'Include All' : 'Exclude All' }}
          </button>
          <button
            class="btn-reset-section"
            title="Reset materials to defaults"
            @click.stop="resetMaterialsToDefaults"
          >
            Reset Section
          </button>
        </div>
      </div>
      <div v-if="sectionsExpanded.materials" class="section-content">
        <table class="market-items-table mobile-card-layout">
          <thead>
            <tr>
              <th v-if="!isStaticMode" class="col-exclude">Exclude</th>
              <th class="col-name sortable" @click="toggleSort('name')">Name <span class="sort-icon">{{ getSortIcon('name') }}</span></th>
              <th class="col-vendor sortable" @click="toggleSort('vendor')">Vendor <span class="sort-icon">{{ getSortIcon('vendor') }}</span></th>
              <th class="col-market sortable" @click="toggleSort('market')">Market <span class="sort-icon">{{ getSortIcon('market') }}</span></th>
              <th class="col-spread sortable" @click="toggleSort('spread')">Spread <span class="sort-icon">{{ getSortIcon('spread') }}</span></th>
              <th v-if="!isStaticMode" class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="material in displayMaterials"
              :key="material.id"
              :class="{ excluded: dataProvider.isRefreshExcluded('materials', material.id) }"
            >
              <td v-if="!isStaticMode" class="col-exclude" data-label="Exclude">
                <input
                  type="checkbox"
                  :checked="dataProvider.isRefreshExcluded('materials', material.id)"
                  :title="
                    dataProvider.isRefreshExcluded('materials', material.id)
                      ? 'Include in refresh'
                      : 'Exclude from refresh'
                  "
                  @change="toggleExclusion('materials', material.id)"
                />
              </td>
              <td class="col-name name-cell" data-label="Name">{{ material.name }}</td>
              <td class="col-vendor" data-label="Vendor Value">
                <span class="vendor-value">
                  {{ material.vendorValue ? material.vendorValue.toLocaleString() : 'N/A' }}<span v-if="material.vendorValue" class="gold-suffix"> gold</span>
                </span>
              </td>
              <td class="col-market" :class="getSpreadClass(material.price, material.vendorValue)" data-label="Market Value">
                <EditableValue
                  :model-value="material.price"
                  :default-value="getDefaultMaterialPrice(material.id)"
                  suffix=" gold"
                  @update:model-value="(value) => updateMaterialPrice(material.id, value)"
                />
              </td>
              <td class="col-spread" :class="getSpreadColorClass(material.price, material.vendorValue)" data-label="Spread">
                {{ formatSpread(material.price, material.vendorValue) }}
              </td>
              <td v-if="!isStaticMode" class="col-actions" data-label="Actions">
                <div class="actions-wrapper">
                  <button
                    class="btn-hashed-id"
                    :class="{ missing: !material.hashedId }"
                    title="View/edit hashed ID"
                    @click="openHashedIdModal('materials', material)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="4" y1="9" x2="20" y2="9"></line>
                      <line x1="4" y1="15" x2="20" y2="15"></line>
                      <line x1="10" y1="3" x2="8" y2="21"></line>
                      <line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-refresh-item"
                    :disabled="!hasApiKey || itemRefreshLoading[`materials-${material.id}`]"
                    :title="hasApiKey ? 'Refresh this item from API' : 'API key required'"
                    @click="refreshItem('materials', material.id)"
                  >
                    <span
                      v-if="itemRefreshLoading[`materials-${material.id}`]"
                      class="spinner-small"
                    ></span>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="isMobileView && !showAllMaterials && sortedMaterials.length > MOBILE_INITIAL_LIMIT"
          class="btn-show-more"
          @click="showAllMaterials = true"
        >
          Show all ({{ sortedMaterials.length }})
        </button>
      </div>
    </section>

    <!-- Craftables Section -->
    <section
      v-if="filteredCraftables.length > 0"
      class="market-section"
      :class="{ collapsed: !sectionsExpanded.craftables }"
    >
      <div class="section-header" @click="toggleSection('craftables')">
        <div class="section-title">
          <svg class="expand-icon" :class="{ expanded: sectionsExpanded.craftables }" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
          <h2>Craftables</h2>
          <span class="item-count">{{ filteredCraftables.length }} items</span>
          <span v-if="overrideStats.craftables > 0 && !isStaticMode" class="override-badge">
            {{ overrideStats.craftables }} overridden
          </span>
          <span
            v-if="
              (dataProvider.getExclusionStats('craftables')?.excluded ?? 0) > 0 && !isStaticMode
            "
            class="exclusion-badge"
          >
            {{ dataProvider.getExclusionStats('craftables')?.excluded ?? 0 }} excluded
          </span>
        </div>
        <div v-if="!isStaticMode" class="section-actions">
          <button
            class="btn-toggle-exclusion"
            :title="
              getCategoryExclusionState('craftables') === 'all'
                ? 'Include all craftables in refresh'
                : 'Exclude all craftables from refresh'
            "
            @click.stop="toggleCategoryExclusion('craftables')"
          >
            <span v-if="getCategoryExclusionState('craftables') === 'all'">☑</span>
            <span v-else-if="getCategoryExclusionState('craftables') === 'mixed'">▣</span>
            <span v-else>☐</span>
            {{ getCategoryExclusionState('craftables') === 'all' ? 'Include All' : 'Exclude All' }}
          </button>
          <button
            class="btn-reset-section"
            title="Reset craftables to defaults"
            @click.stop="resetCraftablesToDefaults"
          >
            Reset Section
          </button>
        </div>
      </div>
      <div v-if="sectionsExpanded.craftables" class="section-content">
        <table class="market-items-table mobile-card-layout">
          <thead>
            <tr>
              <th v-if="!isStaticMode" class="col-exclude">Exclude</th>
              <th class="col-name sortable" @click="toggleSort('name')">Name <span class="sort-icon">{{ getSortIcon('name') }}</span></th>
              <th class="col-vendor sortable" @click="toggleSort('vendor')">Vendor <span class="sort-icon">{{ getSortIcon('vendor') }}</span></th>
              <th class="col-market sortable" @click="toggleSort('market')">Market <span class="sort-icon">{{ getSortIcon('market') }}</span></th>
              <th class="col-spread sortable" @click="toggleSort('spread')">Spread <span class="sort-icon">{{ getSortIcon('spread') }}</span></th>
              <th v-if="!isStaticMode" class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="craftable in displayCraftables"
              :key="craftable.id"
              :class="{ excluded: dataProvider.isRefreshExcluded('craftables', craftable.id) }"
            >
              <td v-if="!isStaticMode" class="col-exclude" data-label="Exclude">
                <input
                  type="checkbox"
                  :checked="dataProvider.isRefreshExcluded('craftables', craftable.id)"
                  :title="
                    dataProvider.isRefreshExcluded('craftables', craftable.id)
                      ? 'Include in refresh'
                      : 'Exclude from refresh'
                  "
                  @change="toggleExclusion('craftables', craftable.id)"
                />
              </td>
              <td class="col-name name-cell" data-label="Name">{{ craftable.name }}</td>
              <td class="col-vendor" data-label="Vendor Value">
                <span class="vendor-value">
                  {{ craftable.vendorValue ? craftable.vendorValue.toLocaleString() : 'N/A' }}<span v-if="craftable.vendorValue" class="gold-suffix"> gold</span>
                </span>
              </td>
              <td class="col-market" :class="getSpreadClass(craftable.price, craftable.vendorValue)" data-label="Market Value">
                <EditableValue
                  :model-value="craftable.price"
                  :default-value="getDefaultCraftablePrice(craftable.id)"
                  suffix=" gold"
                  @update:model-value="(value) => updateCraftablePrice(craftable.id, value)"
                />
              </td>
              <td class="col-spread" :class="getSpreadColorClass(craftable.price, craftable.vendorValue)" data-label="Spread">
                {{ formatSpread(craftable.price, craftable.vendorValue) }}
              </td>
              <td v-if="!isStaticMode" class="col-actions" data-label="Actions">
                <div class="actions-wrapper">
                  <button
                    class="btn-hashed-id"
                    :class="{ missing: !craftable.hashedId }"
                    title="View/edit hashed ID"
                    @click="openHashedIdModal('craftables', craftable)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="4" y1="9" x2="20" y2="9"></line>
                      <line x1="4" y1="15" x2="20" y2="15"></line>
                      <line x1="10" y1="3" x2="8" y2="21"></line>
                      <line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-refresh-item"
                    :disabled="!hasApiKey || itemRefreshLoading[`craftables-${craftable.id}`]"
                    :title="hasApiKey ? 'Refresh this item from API' : 'API key required'"
                    @click="refreshItem('craftables', craftable.id)"
                  >
                    <span
                      v-if="itemRefreshLoading[`craftables-${craftable.id}`]"
                      class="spinner-small"
                    ></span>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="isMobileView && !showAllCraftables && sortedCraftables.length > MOBILE_INITIAL_LIMIT"
          class="btn-show-more"
          @click="showAllCraftables = true"
        >
          Show all ({{ sortedCraftables.length }})
        </button>
      </div>
    </section>

    <!-- Resources Section -->
    <section
      v-if="filteredResources.length > 0"
      class="market-section"
      :class="{ collapsed: !sectionsExpanded.resources }"
    >
      <div class="section-header" @click="toggleSection('resources')">
        <div class="section-title">
          <svg class="expand-icon" :class="{ expanded: sectionsExpanded.resources }" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
          <h2>Resources</h2>
          <span class="item-count">{{ filteredResources.length }} items</span>
          <span v-if="overrideStats.resources > 0 && !isStaticMode" class="override-badge">
            {{ overrideStats.resources }} overridden
          </span>
          <span
            v-if="(dataProvider.getExclusionStats('resources')?.excluded ?? 0) > 0 && !isStaticMode"
            class="exclusion-badge"
          >
            {{ dataProvider.getExclusionStats('resources')?.excluded ?? 0 }} excluded
          </span>
        </div>
        <div v-if="!isStaticMode" class="section-actions">
          <button
            class="btn-toggle-exclusion"
            :title="
              getCategoryExclusionState('resources') === 'all'
                ? 'Include all resources in refresh'
                : 'Exclude all resources from refresh'
            "
            @click.stop="toggleCategoryExclusion('resources')"
          >
            <span v-if="getCategoryExclusionState('resources') === 'all'">☑</span>
            <span v-else-if="getCategoryExclusionState('resources') === 'mixed'">▣</span>
            <span v-else>☐</span>
            {{ getCategoryExclusionState('resources') === 'all' ? 'Include All' : 'Exclude All' }}
          </button>
          <button
            class="btn-reset-section"
            title="Reset resources to defaults"
            @click.stop="resetResourcesToDefaults"
          >
            Reset Section
          </button>
        </div>
      </div>
      <div v-if="sectionsExpanded.resources" class="section-content">
        <table class="market-items-table mobile-card-layout">
          <thead>
            <tr>
              <th v-if="!isStaticMode" class="col-exclude">Exclude</th>
              <th class="col-name sortable" @click="toggleSort('name')">Name <span class="sort-icon">{{ getSortIcon('name') }}</span></th>
              <th class="col-vendor sortable" @click="toggleSort('vendor')">Vendor <span class="sort-icon">{{ getSortIcon('vendor') }}</span></th>
              <th class="col-market sortable" @click="toggleSort('market')">Market <span class="sort-icon">{{ getSortIcon('market') }}</span></th>
              <th class="col-spread sortable" @click="toggleSort('spread')">Spread <span class="sort-icon">{{ getSortIcon('spread') }}</span></th>
              <th v-if="!isStaticMode" class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="resource in displayResources"
              :key="resource.id"
              :class="{ excluded: dataProvider.isRefreshExcluded('resources', resource.id) }"
            >
              <td v-if="!isStaticMode" class="col-exclude" data-label="Exclude">
                <input
                  type="checkbox"
                  :checked="dataProvider.isRefreshExcluded('resources', resource.id)"
                  :title="
                    dataProvider.isRefreshExcluded('resources', resource.id)
                      ? 'Include in refresh'
                      : 'Exclude from refresh'
                  "
                  @change="toggleExclusion('resources', resource.id)"
                />
              </td>
              <td class="col-name name-cell" data-label="Name">{{ resource.name }}</td>
              <td class="col-vendor" data-label="Vendor Value">
                <span class="vendor-value">{{ resource.vendorValue.toLocaleString() }}<span class="gold-suffix"> gold</span></span>
              </td>
              <td class="col-market" :class="getSpreadClass(resource.marketPrice, resource.vendorValue)" data-label="Market Value">
                <EditableValue
                  :model-value="resource.marketPrice"
                  :default-value="getDefaultResourcePrice(resource.id)"
                  suffix=" gold"
                  @update:model-value="(value) => updateResourcePrice(resource.id, value)"
                />
              </td>
              <td class="col-spread" :class="getSpreadColorClass(resource.marketPrice, resource.vendorValue)" data-label="Spread">
                {{ formatSpread(resource.marketPrice, resource.vendorValue) }}
              </td>
              <td v-if="!isStaticMode" class="col-actions" data-label="Actions">
                <div class="actions-wrapper">
                  <button
                    class="btn-hashed-id"
                    :class="{ missing: !resource.hashedId }"
                    title="View/edit hashed ID"
                    @click="openHashedIdModal('resources', resource)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="4" y1="9" x2="20" y2="9"></line>
                      <line x1="4" y1="15" x2="20" y2="15"></line>
                      <line x1="10" y1="3" x2="8" y2="21"></line>
                      <line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-refresh-item"
                    :disabled="!hasApiKey || itemRefreshLoading[`resources-${resource.id}`]"
                    :title="hasApiKey ? 'Refresh this item from API' : 'API key required'"
                    @click="refreshItem('resources', resource.id)"
                  >
                    <span
                      v-if="itemRefreshLoading[`resources-${resource.id}`]"
                      class="spinner-small"
                    ></span>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="isMobileView && !showAllResources && sortedResources.length > MOBILE_INITIAL_LIMIT"
          class="btn-show-more"
          @click="showAllResources = true"
        >
          Show all ({{ sortedResources.length }})
        </button>
      </div>
    </section>

    <!-- Recipes Section -->
    <section
      v-if="filteredRecipes.length > 0"
      class="market-section"
      :class="{ collapsed: !sectionsExpanded.recipes }"
    >
      <div class="section-header" @click="toggleSection('recipes')">
        <div class="section-title">
          <svg class="expand-icon" :class="{ expanded: sectionsExpanded.recipes }" viewBox="0 0 20 20" fill="currentColor" width="20" height="20"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" /></svg>
          <h2>Recipes</h2>
          <span class="item-count">{{ filteredRecipes.length }} items</span>
          <span v-if="overrideStats.recipes > 0 && !isStaticMode" class="override-badge">
            {{ overrideStats.recipes }} overridden
          </span>
          <span
            v-if="(dataProvider.getExclusionStats('recipes')?.excluded ?? 0) > 0 && !isStaticMode"
            class="exclusion-badge"
          >
            {{ dataProvider.getExclusionStats('recipes')?.excluded ?? 0 }} excluded
          </span>
        </div>
        <div v-if="!isStaticMode" class="section-actions">
          <button
            v-if="untrackedCraftableCount > 0 && !trackAllLoading"
            class="btn-track-all"
            :disabled="!hasApiKey"
            :title="hasApiKey ? 'Track all untracked craftable recipes' : 'API key required'"
            @click.stop="trackAllUntrackedCraftables"
          >
            Track All ({{ untrackedCraftableCount }})
          </button>
          <div v-if="trackAllLoading" class="track-all-progress" @click.stop>
            <span class="progress-text">
              Tracking {{ trackAllProgress.current }}/{{ trackAllProgress.total }}...
            </span>
            <button
              class="btn-cancel-track"
              title="Cancel tracking operation"
              @click.stop="cancelTrackAll"
            >
              ✕ Cancel
            </button>
          </div>
          <button
            class="btn-toggle-exclusion"
            :title="
              getCategoryExclusionState('recipes') === 'all'
                ? 'Include all recipes in refresh'
                : 'Exclude all recipes from refresh'
            "
            @click.stop="toggleCategoryExclusion('recipes')"
          >
            <span v-if="getCategoryExclusionState('recipes') === 'all'">☑</span>
            <span v-else-if="getCategoryExclusionState('recipes') === 'mixed'">▣</span>
            <span v-else>☐</span>
            {{ getCategoryExclusionState('recipes') === 'all' ? 'Include All' : 'Exclude All' }}
          </button>
          <button
            class="btn-reset-section"
            title="Reset recipes to defaults"
            @click.stop="resetRecipesToDefaults"
          >
            Reset Section
          </button>
        </div>
      </div>
      <div v-if="sectionsExpanded.recipes" class="section-content">
        <table class="market-items-table mobile-card-layout">
          <thead>
            <tr>
              <th v-if="!isStaticMode" class="col-exclude">Exclude</th>
              <th class="col-name sortable" @click="toggleSort('name')">Name <span class="sort-icon">{{ getSortIcon('name') }}</span></th>
              <th class="col-vendor sortable" @click="toggleSort('vendor')">Vendor <span class="sort-icon">{{ getSortIcon('vendor') }}</span></th>
              <th class="col-market sortable" @click="toggleSort('market')">Market <span class="sort-icon">{{ getSortIcon('market') }}</span></th>
              <th class="col-spread sortable" @click="toggleSort('spread')">Spread <span class="sort-icon">{{ getSortIcon('spread') }}</span></th>
              <th v-if="!isStaticMode" class="col-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="recipe in displayRecipes"
              :key="recipe.id"
              :class="{ excluded: dataProvider.isRefreshExcluded('recipes', recipe.id) }"
            >
              <td v-if="!isStaticMode" class="col-exclude" data-label="Exclude">
                <input
                  type="checkbox"
                  :checked="dataProvider.isRefreshExcluded('recipes', recipe.id)"
                  :title="
                    dataProvider.isRefreshExcluded('recipes', recipe.id)
                      ? 'Include in refresh'
                      : 'Exclude from refresh'
                  "
                  @change="toggleExclusion('recipes', recipe.id)"
                />
              </td>
              <td class="col-name name-cell" data-label="Name">
                <span>{{ recipe.name }}</span>
                <span
                  v-if="isUntrackedCraftableRecipe(recipe.name, recipe.producesItemName)"
                  class="untracked-badge"
                  title="This recipe produces a craftable that's not yet tracked"
                >
                  Untracked Craftable
                </span>
              </td>
              <td class="col-vendor" data-label="Vendor Value">
                <span class="vendor-value">
                  {{ recipe.vendorValue ? recipe.vendorValue.toLocaleString() : 'N/A' }}<span v-if="recipe.vendorValue" class="gold-suffix"> gold</span>
                </span>
              </td>
              <td class="col-market" :class="getSpreadClass(recipe.price, recipe.vendorValue)" data-label="Market Value">
                <EditableValue
                  :model-value="recipe.price"
                  :default-value="getDefaultRecipePrice(recipe.id)"
                  suffix=" gold"
                  @update:model-value="(value) => updateRecipePrice(recipe.id, value)"
                />
              </td>
              <td class="col-spread" :class="getSpreadColorClass(recipe.price, recipe.vendorValue)" data-label="Spread">
                {{ formatSpread(recipe.price, recipe.vendorValue) }}
              </td>
              <td v-if="!isStaticMode" class="col-actions" data-label="Actions">
                <div class="actions-wrapper">
                  <button
                    v-if="isUntrackedCraftableRecipe(recipe.name, recipe.producesItemName)"
                    class="btn-add-recipe"
                    :title="
                      hasApiKey
                        ? 'Add this craftable to tracked craftables'
                        : 'API key required to add craftable'
                    "
                    :disabled="!hasApiKey || addRecipeLoading[recipe.id]"
                    @click="addUntrackedCraftable(recipe)"
                  >
                    <span v-if="addRecipeLoading[recipe.id]">...</span>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="16"></line>
                      <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-hashed-id"
                    :class="{ missing: !recipe.hashedId }"
                    title="View/edit hashed ID"
                    @click="openHashedIdModal('recipes', recipe)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <line x1="4" y1="9" x2="20" y2="9"></line>
                      <line x1="4" y1="15" x2="20" y2="15"></line>
                      <line x1="10" y1="3" x2="8" y2="21"></line>
                      <line x1="16" y1="3" x2="14" y2="21"></line>
                    </svg>
                  </button>
                  <button
                    class="btn-refresh-item"
                    :disabled="!hasApiKey || itemRefreshLoading[`recipes-${recipe.id}`]"
                    :title="hasApiKey ? 'Refresh this item from API' : 'API key required'"
                    @click="refreshItem('recipes', recipe.id)"
                  >
                    <span
                      v-if="itemRefreshLoading[`recipes-${recipe.id}`]"
                      class="spinner-small"
                    ></span>
                    <svg
                      v-else
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    >
                      <polyline points="23 4 23 10 17 10"></polyline>
                      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <button
          v-if="isMobileView && !showAllRecipes && sortedRecipes.length > MOBILE_INITIAL_LIMIT"
          class="btn-show-more"
          @click="showAllRecipes = true"
        >
          Show all ({{ sortedRecipes.length }})
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.market-table {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 960px;
  margin: 0 auto;
}

.market-summary {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  text-align: center;
  padding: 0.25rem 0;
}

/* Search Bar */
.search-bar-container {
  position: sticky;
  top: 0;
  z-index: 10;
  background-color: var(--bg-primary);
  padding: 0.75rem 0;
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.search-bar {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.875rem;
  color: var(--text-secondary);
  pointer-events: none;
  transition: color 0.2s;
}

.search-input-wrapper:focus-within .search-icon {
  color: var(--accent-primary);
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  font-size: 1rem;
  background-color: var(--bg-secondary);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  border-radius: 0.5rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.search-input::placeholder {
  color: var(--text-secondary);
}

.search-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.search-count {
  color: var(--text-primary);
  font-weight: 600;
}

.override-count {
  padding: 0.25rem 0.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
}

.override-count.active {
  background-color: rgba(59, 130, 246, 0.1);
  border-color: rgba(59, 130, 246, 0.3);
  color: var(--accent-primary);
}

.exclusion-count {
  padding: 0.25rem 0.5rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.25rem;
}

.exclusion-count.active {
  background-color: rgba(245, 158, 11, 0.1);
  border-color: rgba(245, 158, 11, 0.3);
  color: var(--warning);
}

.btn-refresh-all {
  padding: 0.75rem 1.5rem;
  background-color: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-refresh-all:hover:not(:disabled) {
  background-color: var(--accent-hover);
}

.btn-refresh-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-reset-all {
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-reset-all:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--danger);
}

/* Refresh Progress */
.refresh-progress-container {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1rem;
}

.refresh-progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.refresh-progress-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.refresh-progress-current {
  font-weight: 600;
  color: var(--text-primary);
  font-size: 0.875rem;
}

.refresh-progress-count {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.btn-cancel-refresh {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel-refresh:hover {
  background-color: rgba(239, 68, 68, 0.1);
}

.progress-bar {
  width: 100%;
  height: 0.5rem;
  background-color: var(--bg-primary);
  border-radius: 0.25rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--accent-primary);
  transition: width 0.3s ease;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
}

.modal-content-small {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  max-width: 500px;
  width: 100%;
}

.modal-header-small {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header-small h3 {
  margin: 0;
  font-size: 1.25rem;
  color: var(--text-primary);
}

.btn-close-modal {
  padding: 0.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-close-modal:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-body {
  padding: 1.5rem;
}

.estimate-text {
  font-size: 0.875rem;
  color: var(--text-primary);
  margin-bottom: 0.75rem;
}

.estimate-excluded {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 0.75rem;
}

.estimate-time {
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 1.5rem;
}

.modal-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-confirm {
  flex: 1;
  padding: 0.75rem 1.5rem;
  background-color: var(--accent-primary);
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-confirm:hover {
  background-color: var(--accent-hover);
}

.btn-cancel-modal {
  flex: 1;
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel-modal:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Spinner */
.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(59, 130, 246, 0.3);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state h3 {
  font-size: 1.5rem;
  color: var(--text-primary);
  margin-bottom: 0.5rem;
}

.empty-state p {
  color: var(--text-secondary);
}

/* Market Section */
.market-section {
  background: linear-gradient(180deg, #1e2436 0%, var(--bg-secondary) 100%);
  border: 1px solid rgba(55, 65, 81, 0.7);
  border-left: 3px solid rgba(96, 165, 250, 0.35);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  transition: border-left-color 0.2s;
}

.market-section:not(.collapsed):hover {
  border-left-color: var(--accent-primary);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 1.5rem;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid var(--border-color);
}

.section-header:hover {
  background-color: var(--bg-tertiary);
}

.market-section.collapsed .section-header {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex: 1;
  flex-wrap: wrap;
}

.section-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.expand-icon {
  color: var(--text-secondary);
  transition: transform 0.25s ease;
  transform: rotate(-90deg);
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(0deg);
}

.section-title h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.item-count {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.override-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 0.25rem;
  color: var(--accent-primary);
  font-weight: 600;
}

.exclusion-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  background-color: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 0.25rem;
  color: var(--warning);
  font-weight: 600;
}

.btn-toggle-exclusion {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}

.btn-toggle-exclusion:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-track-all {
  padding: 0.375rem 0.75rem;
  background-color: var(--success);
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-track-all:hover:not(:disabled) {
  background-color: color-mix(in srgb, var(--success) 80%, black);
}

.btn-track-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.track-all-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.75rem;
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
}

.progress-text {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
}

.btn-cancel-track {
  padding: 0.25rem 0.5rem;
  background-color: var(--danger);
  color: white;
  border: none;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn-cancel-track:hover {
  background-color: color-mix(in srgb, var(--danger) 85%, black);
}

.btn-reset-section {
  padding: 0.5rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-reset-section:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
  border-color: var(--danger);
}

.section-content {
  overflow-x: auto;
}

@media (max-width: 767px) {
  .section-content {
    overflow-x: visible;
  }
}

/* Market Items Table */
.market-items-table {
  width: 100%;
  border-collapse: collapse;
}

.market-items-table thead {
  background-color: var(--bg-tertiary);
  border-bottom: 2px solid rgba(96, 165, 250, 0.2);
}

.market-items-table th {
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.75rem;
  font-weight: 600;
  color: #d1d5db;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.market-items-table td {
  padding: 0.625rem 0.75rem;
  border-bottom: 1px solid var(--border-color);
}

.market-items-table tbody tr:last-child td {
  border-bottom: none;
}

.market-items-table tbody tr {
  transition: all 0.2s ease-in-out;
}

.market-items-table tbody tr:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.015);
}

.market-items-table tbody tr:hover {
  background-color: var(--bg-tertiary);
  transform: translateX(4px);
  box-shadow: -4px 0 0 0 var(--accent-primary);
}

.market-items-table tbody tr.excluded {
  opacity: 0.5;
}

.market-items-table tbody tr.excluded:hover {
  opacity: 0.7;
  transform: translateX(2px);
  box-shadow: -4px 0 0 0 var(--text-secondary);
}

.col-exclude {
  width: 60px;
  text-align: center;
}

.col-exclude input[type='checkbox'] {
  cursor: pointer;
  width: 16px;
  height: 16px;
}

.col-name {
  font-weight: 600;
  color: var(--text-primary);
}

.col-vendor {
  color: var(--text-secondary);
  font-size: 0.875rem;
}

.col-actions {
  text-align: center;
}

/* Desktop-only column widths — must not apply on mobile where card layout controls sizing */
@media (min-width: 768px) {
  .col-name {
    width: 30%;
  }

  .col-vendor {
    width: 20%;
    text-align: right;
  }

  .col-market {
    width: 20%;
    min-width: 160px;
    text-align: right;
  }

  .col-spread {
    width: 12%;
  }

  .col-actions {
    width: 100px;
  }
}

.actions-wrapper {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  justify-content: center;
}

.vendor-value {
  color: var(--text-secondary);
}

.btn-refresh-item {
  padding: 0.375rem;
  background-color: transparent;
  color: var(--accent-primary);
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-refresh-item:hover:not(:disabled) {
  background-color: var(--bg-tertiary);
  color: var(--accent-primary);
}

.btn-refresh-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-hashed-id {
  padding: 0.375rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-hashed-id:hover {
  background-color: var(--bg-tertiary);
  color: var(--text-primary);
}

.btn-hashed-id.missing {
  color: var(--warning);
}

.btn-hashed-id.missing:hover {
  background-color: rgba(245, 158, 11, 0.1);
  color: var(--warning);
}

.btn-add-recipe {
  padding: 0.375rem;
  background-color: transparent;
  color: var(--success);
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn-add-recipe:hover {
  background-color: var(--bg-tertiary);
  color: var(--success);
}

.untracked-badge {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.125rem 0.375rem;
  background-color: rgba(16, 185, 129, 0.1);
  color: var(--success);
  border: 1px solid var(--success);
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Responsive Design */
@media (max-width: 767px) {
  .market-table {
    gap: 0.75rem;
  }

  .search-bar-container {
    flex-direction: column;
    align-items: stretch;
    padding: 0.5rem 0;
  }

  .btn-refresh-all,
  .btn-reset-all {
    width: 100%;
  }

  .section-header {
    flex-direction: column;
    gap: 0.5rem;
    align-items: flex-start;
    padding: 0.75rem;
  }

  .section-actions {
    width: 100%;
    flex-direction: column;
  }

  .btn-toggle-exclusion,
  .btn-reset-section,
  .btn-track-all,
  .track-all-progress {
    width: 100%;
  }

  .market-items-table th,
  .market-items-table td {
    padding: 0.75rem;
  }

  .section-title {
    flex-wrap: wrap;
  }

  .refresh-progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
  }

  .btn-cancel-refresh {
    width: 100%;
  }

  .modal-overlay {
    padding: 1rem;
  }

  .modal-actions {
    flex-direction: column;
  }

  .col-actions {
    width: 80px;
  }

  .actions-wrapper {
    flex-direction: column;
    gap: 0.25rem;
  }

  .btn-hashed-id,
  .btn-refresh-item {
    width: 100%;
  }
}

/* Market value spread differentiation */
.spread-extreme :deep(.value) {
  color: var(--success);
  font-weight: 700;
}

.spread-high :deep(.value) {
  color: var(--success);
  font-weight: 600;
  opacity: 0.85;
}

.spread-moderate :deep(.value) {
  color: var(--text-primary);
  font-weight: 500;
}

/* Sortable column headers */
.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s;
  white-space: nowrap;
}

.sortable:hover {
  color: var(--text-primary);
}

.sort-icon {
  display: inline-block;
  margin-left: 0.25rem;
  font-size: 0.875rem;
  color: rgba(96, 165, 250, 0.6);
  vertical-align: middle;
}

.sortable:hover .sort-icon {
  color: rgba(96, 165, 250, 1);
}

/* Spread column */
.col-spread {
  font-weight: 700;
  font-size: 0.875rem;
  white-space: nowrap;
  text-align: right;
}

.spread-extreme {
  color: var(--success);
  font-weight: 700;
  background: linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.15) 100%);
}

.spread-high {
  color: var(--success);
  background: linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.08) 100%);
}

.spread-moderate {
  color: #86efac;
  font-weight: 700;
  background: linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.06) 100%);
}

.spread-low {
  color: var(--text-secondary);
  font-weight: 600;
}

.spread-negative {
  color: var(--danger);
  background: linear-gradient(90deg, transparent 0%, rgba(239, 68, 68, 0.08) 100%);
}

/* Mobile market card density */
/* Show More Button */
.btn-show-more {
  display: block;
  margin: 0.5rem auto 0;
  padding: 0.375rem 1rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-show-more:hover {
  background-color: var(--bg-tertiary);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  color: var(--text-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.btn-show-more:active {
  transform: scale(0.98);
}

@media (max-width: 767px) {
  .market-items-table.mobile-card-layout tbody tr {
    padding: 0.5rem 0.625rem 0.5rem 0.75rem;
    margin-bottom: 0.5rem;
    border-left: 3px solid var(--accent-primary);
    border-radius: 0.5rem;
    background: linear-gradient(135deg, #1e2436 0%, #1a1f2e 100%);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .market-items-table.mobile-card-layout td {
    padding: 0.1875rem 0.375rem;
    font-size: 0.8125rem;
    line-height: 1.35;
  }

  /* Spread mirrors Profit/hr position — top-right of card */
  .market-items-table.mobile-card-layout .col-spread {
    font-size: 0.875rem;
    font-weight: 700;
  }
}
</style>
