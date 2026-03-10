/**
 * Market Refresh Composable
 *
 * Handles all market price refresh logic with API-driven updates.
 * Provides both single-item and bulk refresh capabilities with:
 * - Rate limiting via existing API client
 * - Refresh exclusion support
 * - Progress tracking and cancellation
 * - Error handling and retry logic
 */

import { ref } from 'vue'
import { useDataProvider } from './useDataProvider'
import { searchItems, getMarketHistory } from '../api/services'
import { invalidate, generateCacheKey } from '../api/cache'
import { computeMarketPrice } from '../utils/computeMarketPrice'

/**
 * Category types that support market refresh
 */
export type RefreshCategory = 'materials' | 'craftables' | 'resources' | 'recipes'

/**
 * Result of a single item refresh operation
 */
export interface RefreshItemResult {
  success: boolean
  category: RefreshCategory
  itemId: string
  itemName: string
  oldPrice: number | null
  newPrice: number | null
  error?: string
}

/**
 * Progress information for bulk refresh operations
 */
export interface RefreshProgress {
  current: number
  total: number
  totalIncluded: number
  skippedCount: number
  currentItem: string | null
}

/**
 * Error information for failed refreshes
 */
export interface RefreshError {
  category: RefreshCategory
  itemId: string
  itemName: string
  error: string
}

/**
 * Estimate information before starting a refresh
 */
export interface RefreshEstimate {
  totalItems: number
  includedItems: number
  excludedItems: number
  estimatedMinutes: number
}

// Singleton instance
let marketRefreshInstance: ReturnType<typeof createMarketRefresh> | null = null

/**
 * Create market refresh instance
 */
function createMarketRefresh() {
  const dataProvider = useDataProvider()

  // Reactive state
  const isRefreshing = ref(false)
  const refreshProgress = ref<RefreshProgress>({
    current: 0,
    total: 0,
    totalIncluded: 0,
    skippedCount: 0,
    currentItem: null,
  })
  const lastRefreshTime = ref<Date | null>(null)
  const refreshErrors = ref<RefreshError[]>([])

  // Cancellation support
  let shouldCancel = false

  /**
   * Get or find the hashed ID for an item
   * First checks if item already has hashedId, otherwise searches for it
   */
  async function getHashedId(
    category: RefreshCategory,
    itemId: string,
    itemName: string
  ): Promise<string | null> {
    // Check if we already have hashedId in the item
    let item: { hashedId?: string } | undefined

    switch (category) {
      case 'materials':
        item = dataProvider.materials.value.find((m) => m.id === itemId)
        break
      case 'craftables':
        item = dataProvider.craftables.value.find((p) => p.id === itemId)
        break
      case 'resources':
        item = dataProvider.resources.value.find((r) => r.id === itemId)
        break
      case 'recipes':
        item = dataProvider.recipes.value.find((r) => r.id === itemId)
        break
    }

    if (item?.hashedId && item.hashedId !== '') {
      return item.hashedId
    }

    // Search for the item by name to get hashedId
    // Invalidate search cache first to ensure fresh results
    const searchCacheKey = generateCacheKey('/item/search', {
      page: 1,
      query: itemName,
    })
    invalidate(searchCacheKey)

    const searchResults = await searchItems(itemName)

    // Use the 'items' array from the response
    const results = searchResults?.items

    if (!results || results.length === 0) {
      console.warn(`No search results found for item: ${itemName}`)
      return null
    }

    // Find exact match (case-insensitive)
    const exactMatch = results.find(
      (result) => result.name.toLowerCase() === itemName.toLowerCase()
    )

    if (exactMatch) {
      // Store hashedId and vendorValue from search results
      dataProvider.updateHashedId(category, itemId, exactMatch.hashed_id)
      if (exactMatch.vendor_price != null) {
        dataProvider.updateVendorValue(category, itemId, exactMatch.vendor_price)
      }
      return exactMatch.hashed_id
    }

    // If no exact match, use first result and warn
    const firstResult = results[0]
    console.warn(`No exact match for "${itemName}", using first result: "${firstResult.name}"`)
    const hashedId = firstResult.hashed_id
    // Store the hashedId and vendorValue even if it's not an exact match
    dataProvider.updateHashedId(category, itemId, hashedId)
    if (firstResult.vendor_price != null) {
      dataProvider.updateVendorValue(category, itemId, firstResult.vendor_price)
    }
    return hashedId
  }

  /**
   * Refresh a single item's market price
   * Does NOT check refresh exclusion - single-item refresh always works
   */
  async function refreshItemPrice(
    category: RefreshCategory,
    itemId: string
  ): Promise<RefreshItemResult> {
    // Get the item to find its name
    let item: { name: string; price?: number; marketPrice?: number } | undefined
    let oldPrice: number | null = null

    switch (category) {
      case 'materials':
        item = dataProvider.materials.value.find((m) => m.id === itemId)
        oldPrice = item?.price ?? null
        break
      case 'craftables':
        item = dataProvider.craftables.value.find((p) => p.id === itemId)
        oldPrice = item?.price ?? null
        break
      case 'resources':
        item = dataProvider.resources.value.find((r) => r.id === itemId)
        oldPrice = item?.marketPrice ?? null
        break
      case 'recipes':
        item = dataProvider.recipes.value.find((r) => r.id === itemId)
        oldPrice = item?.price ?? null
        break
    }

    if (!item) {
      return {
        success: false,
        category,
        itemId,
        itemName: 'Unknown',
        oldPrice: null,
        newPrice: null,
        error: 'Item not found',
      }
    }

    const itemName = item.name

    try {
      // Get hashedId
      const hashedId = await getHashedId(category, itemId, itemName)

      if (!hashedId) {
        return {
          success: false,
          category,
          itemId,
          itemName,
          oldPrice,
          newPrice: null,
          error: 'Could not find item hash ID',
        }
      }

      // Invalidate market history cache to get fresh prices
      const marketCacheKey = generateCacheKey(`/item/${hashedId}/market-history`, {
        tier: 0,
        type: 'listings',
      })
      invalidate(marketCacheKey)

      // Get market history to extract both price and lastSaleAt
      const marketHistory = await getMarketHistory(hashedId, 0, 'listings')

      if (!marketHistory.latest_sold || marketHistory.latest_sold.length === 0) {
        return {
          success: false,
          category,
          itemId,
          itemName,
          oldPrice,
          newPrice: null,
          error: 'No market data available',
        }
      }

      // Compute VWAP from last 24h sales (or fallback to most recent sale)
      const averagePrice = computeMarketPrice(marketHistory.latest_sold)

      if (averagePrice === null) {
        return {
          success: false,
          category,
          itemId,
          itemName,
          oldPrice,
          newPrice: null,
          error: 'No market data available',
        }
      }

      // Extract the most recent sold_at timestamp
      // latest_sold is sorted by recency (most recent first)
      const lastSaleAt = marketHistory.latest_sold[0].sold_at

      // Update the item's price and lastSaleAt in the data provider
      switch (category) {
        case 'materials':
          dataProvider.updateMaterialPrice(itemId, averagePrice)
          dataProvider.updateLastSaleAt('materials', itemId, lastSaleAt)
          break
        case 'craftables':
          dataProvider.updateCraftablePrice(itemId, averagePrice)
          dataProvider.updateLastSaleAt('craftables', itemId, lastSaleAt)
          break
        case 'resources':
          dataProvider.updateResourcePrice(itemId, averagePrice)
          break
        case 'recipes':
          dataProvider.updateRecipe(itemId, { price: averagePrice })
          dataProvider.updateLastSaleAt('recipes', itemId, lastSaleAt)
          break
      }

      return {
        success: true,
        category,
        itemId,
        itemName,
        oldPrice,
        newPrice: averagePrice,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        success: false,
        category,
        itemId,
        itemName,
        oldPrice,
        newPrice: null,
        error: errorMessage,
      }
    }
  }

  /**
   * Get all items across all categories
   */
  function getAllItems(): Array<{
    category: RefreshCategory
    itemId: string
    itemName: string
  }> {
    const items: Array<{
      category: RefreshCategory
      itemId: string
      itemName: string
    }> = []

    // Materials
    dataProvider.materials.value.forEach((item) => {
      items.push({
        category: 'materials',
        itemId: item.id,
        itemName: item.name,
      })
    })

    // Craftables
    dataProvider.craftables.value.forEach((item) => {
      items.push({
        category: 'craftables',
        itemId: item.id,
        itemName: item.name,
      })
    })

    // Resources
    dataProvider.resources.value.forEach((item) => {
      items.push({
        category: 'resources',
        itemId: item.id,
        itemName: item.name,
      })
    })

    // Recipes
    dataProvider.recipes.value.forEach((item) => {
      items.push({
        category: 'recipes',
        itemId: item.id,
        itemName: item.name,
      })
    })

    return items
  }

  /**
   * Get refresh estimate before starting
   */
  function getRefreshEstimate(): RefreshEstimate {
    const allItems = getAllItems()
    const includedItems = allItems.filter(
      (item) => !dataProvider.isRefreshExcluded(item.category, item.itemId)
    )

    // Estimate time: ~20 requests/min = 3 seconds per request
    // Each item needs 1-2 requests (search + market history)
    // Conservative estimate: 2 requests per item = 6 seconds per item
    const estimatedMinutes = Math.ceil((includedItems.length * 6) / 60)

    return {
      totalItems: allItems.length,
      includedItems: includedItems.length,
      excludedItems: allItems.length - includedItems.length,
      estimatedMinutes,
    }
  }

  /**
   * Refresh all items across all categories
   * Skips items where isRefreshExcluded() returns true
   * Supports cancellation via cancelRefresh()
   */
  async function refreshAllItems(options?: {
    onProgress?: (progress: RefreshProgress) => void
  }): Promise<void> {
    if (isRefreshing.value) {
      throw new Error('Refresh already in progress')
    }

    // Reset state
    isRefreshing.value = true
    shouldCancel = false
    refreshErrors.value = []

    const allItems = getAllItems()
    const includedItems = allItems.filter(
      (item) => !dataProvider.isRefreshExcluded(item.category, item.itemId)
    )

    refreshProgress.value = {
      current: 0,
      total: allItems.length,
      totalIncluded: includedItems.length,
      skippedCount: allItems.length - includedItems.length,
      currentItem: null,
    }

    try {
      for (const item of includedItems) {
        // Check for cancellation
        if (shouldCancel) {
          console.log('Refresh cancelled by user')
          break
        }

        // Update progress
        refreshProgress.value.currentItem = item.itemName
        options?.onProgress?.(refreshProgress.value)

        // Refresh the item
        const result = await refreshItemPrice(item.category, item.itemId)

        // Track errors
        if (!result.success) {
          refreshErrors.value.push({
            category: result.category,
            itemId: result.itemId,
            itemName: result.itemName,
            error: result.error || 'Unknown error',
          })
        }

        // Update progress
        refreshProgress.value.current++
        options?.onProgress?.(refreshProgress.value)
      }

      // Mark completion time
      lastRefreshTime.value = new Date()
    } finally {
      // Clean up
      isRefreshing.value = false
      refreshProgress.value.currentItem = null
    }
  }

  /**
   * Cancel an ongoing bulk refresh
   */
  function cancelRefresh(): void {
    if (isRefreshing.value) {
      shouldCancel = true
    }
  }

  return {
    // Reactive state
    isRefreshing,
    refreshProgress,
    lastRefreshTime,
    refreshErrors,

    // Methods
    refreshItemPrice,
    refreshAllItems,
    cancelRefresh,
    getRefreshEstimate,
  }
}

/**
 * Market refresh composable (singleton)
 *
 * Returns the same reactive instance on every call.
 * This ensures all components share the same refresh state.
 */
export function useMarketRefresh() {
  if (!marketRefreshInstance) {
    marketRefreshInstance = createMarketRefresh()
  }
  return marketRefreshInstance
}
