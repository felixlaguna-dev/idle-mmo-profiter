/**
 * API service methods for IdleMMO items and market data
 *
 * All methods:
 * 1. Check if API key is configured (if not, return default data)
 * 2. Check cache first
 * 3. If cache miss, make API request through rate-limited client
 * 4. Cache the response before returning
 * 5. If API request fails, fall back to default data
 */

import { apiClient } from './client'
import { get, set, generateCacheKey } from './cache'
import type { AuthCheckResponse } from '../types'
import { computeMarketPrice } from '../utils/computeMarketPrice'

/**
 * API response types based on IdleMMO API documentation
 */

export interface ItemSearchResult {
  hashed_id: string
  name: string
  description: string
  image_url: string
  type: string
  quality: string
  vendor_price: number | null
}

export interface ItemSearchResponse {
  items: ItemSearchResult[]
  pagination: {
    current_page: number
    last_page: number
    per_page: number
    total: number
    from: number
    to: number
  }
}

export interface ItemRecipeMaterial {
  hashed_item_id: string
  item_name: string
  quantity: number
}

export interface ItemRecipeResult {
  hashed_item_id: string
  item_name: string
}

export interface ItemRecipe {
  skill: string
  level_required: number
  max_uses: number | null
  experience: number
  materials: ItemRecipeMaterial[]
  result: ItemRecipeResult | null
}

export interface ItemEffect {
  value: number
  length: number
  target: string
  attribute: string
  value_type: string
}

export interface ItemDetails {
  hashed_id: string
  name: string
  vendor_price: number
  is_tradeable: boolean
  max_tier: number
  description?: string
  type?: string
  image?: string
  recipe?: ItemRecipe | null
  effects?: ItemEffect[] | null
}

export interface MarketHistoryEntry {
  date: string
  total_sold: number
  average_price: number
}

export interface LatestSoldEntry {
  item: {
    hashed_id: string
    name: string
    image_url: string
  }
  tier: number
  quantity: number
  price_per_item: number
  total_price: number
  sold_at: string
}

export interface MarketHistoryResponse {
  history_data: MarketHistoryEntry[]
  latest_sold: LatestSoldEntry[]
  type: string
  endpoint_updates_at: string
}

/**
 * Default/empty responses when API is not configured or fails
 */

const EMPTY_SEARCH_RESPONSE: ItemSearchResponse = {
  items: [],
  pagination: {
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    from: 0,
    to: 0,
  },
}

const EMPTY_MARKET_HISTORY: MarketHistoryResponse = {
  history_data: [],
  latest_sold: [],
  type: 'listings',
  endpoint_updates_at: new Date().toISOString(),
}

/**
 * Search for items by name or type
 *
 * @param query - Optional search query (item name)
 * @param type - Optional item type filter
 * @param page - Page number (default: 1)
 * @returns Item search results with pagination
 */
export async function searchItems(
  query?: string,
  type?: string,
  page = 1
): Promise<ItemSearchResponse> {
  // Check if API key is configured
  if (!apiClient.isConfigured()) {
    console.log('API key not configured, returning empty search results')
    return EMPTY_SEARCH_RESPONSE
  }

  // Build params object (only include defined params)
  const params: Record<string, string | number> = { page }
  if (query) params.query = query
  if (type) params.type = type

  // Build cache key from URL + params
  const cacheKey = generateCacheKey('/item/search', params)

  // Check cache first
  const cached = get<ItemSearchResponse>(cacheKey)
  if (cached) {
    console.log(`Cache hit for item search: ${query || type || 'all'} (page ${page})`)
    return cached
  }

  // Cache miss - make API request
  console.log(
    `Cache miss for item search: ${query || type || 'all'} (page ${page}), fetching from API`
  )

  try {
    const data = await apiClient.get<ItemSearchResponse>('/item/search', params)

    // Cache the result
    set(cacheKey, data)

    return data
  } catch (error) {
    console.error('Failed to search items, returning empty results:', error)
    return EMPTY_SEARCH_RESPONSE
  }
}

/**
 * Get detailed information about a specific item (inspect endpoint)
 *
 * @param hashedItemId - The hashed item ID
 * @returns Detailed item information including recipes, stats, and vendor price
 */
export async function inspectItem(hashedItemId: string): Promise<ItemDetails | null> {
  // Check if API key is configured
  if (!apiClient.isConfigured()) {
    console.log('API key not configured, cannot inspect item')
    return null
  }

  // Build cache key from URL
  const cacheKey = generateCacheKey(`/item/${hashedItemId}/inspect`)

  // Check cache first
  const cached = get<ItemDetails>(cacheKey)
  if (cached) {
    console.log(`Cache hit for item details: ${hashedItemId}`)
    return cached
  }

  // Cache miss - make API request
  console.log(`Cache miss for item details: ${hashedItemId}, fetching from API`)

  try {
    const response = await apiClient.get<{ item: ItemDetails }>(`/item/${hashedItemId}/inspect`)

    // Extract the item from the wrapped response
    const data = response.item

    // Cache the result
    set(cacheKey, data)

    return data
  } catch (error) {
    console.error('Failed to inspect item, returning null:', error)
    return null
  }
}

/**
 * Alias for inspectItem - kept for backwards compatibility
 */
export async function getItemDetails(hashedItemId: string): Promise<ItemDetails | null> {
  return inspectItem(hashedItemId)
}

/**
 * Get market history and current listings for an item
 *
 * @param hashedItemId - The hashed item ID
 * @param tier - Optional item tier filter
 * @param type - Optional listing type filter ('listings' or 'orders')
 * @returns Market history, buy orders, and sell orders
 */
export async function getMarketHistory(
  hashedItemId: string,
  tier: number = 0,
  type: 'listings' | 'orders' = 'listings'
): Promise<MarketHistoryResponse> {
  // Check if API key is configured
  if (!apiClient.isConfigured()) {
    console.log('API key not configured, returning empty market history')
    return EMPTY_MARKET_HISTORY
  }

  // Both tier and type are required by the API
  const params: Record<string, string | number> = { tier, type }

  // Build cache key from URL + params
  const cacheKey = generateCacheKey(`/item/${hashedItemId}/market-history`, params)

  // Check cache first
  const cached = get<MarketHistoryResponse>(cacheKey)
  if (cached) {
    console.log(`Cache hit for market history: ${hashedItemId}`)
    return cached
  }

  // Cache miss - make API request
  console.log(`Cache miss for market history: ${hashedItemId}, fetching from API`)

  try {
    const data = await apiClient.get<MarketHistoryResponse>(
      `/item/${hashedItemId}/market-history`,
      params
    )

    // Cache the result (TTL automatically inferred as 1 hour for market-history)
    set(cacheKey, data)

    return data
  } catch (error) {
    console.error('Failed to get market history, returning empty data:', error)
    return EMPTY_MARKET_HISTORY
  }
}

/**
 * Get the average price from latest sold items
 * This replaces the old buy/sell order system with actual sale data
 *
 * @param hashedItemId - The hashed item ID
 * @param tier - Optional item tier filter
 * @returns Average price from latest sales, or null if no data
 */
export async function getMarketPrices(
  hashedItemId: string,
  tier?: number
): Promise<{ buyPrice: number | null; sellPrice: number | null }> {
  const marketData = await getMarketHistory(hashedItemId, tier)

  // Calculate VWAP from recent sales using computeMarketPrice
  const averagePrice = computeMarketPrice(marketData.latest_sold)

  // Return as both buy and sell price (same value since we only have sale data)
  return { buyPrice: averagePrice, sellPrice: averagePrice }
}

/**
 * Get average market price from recent sales
 *
 * @param hashedItemId - The hashed item ID
 * @param tier - Optional item tier filter
 * @returns Average price or null if no data
 */
export async function getAverageMarketPrice(
  hashedItemId: string,
  tier?: number
): Promise<number | null> {
  const marketData = await getMarketHistory(hashedItemId, tier)

  return computeMarketPrice(marketData.latest_sold)
}

/**
 * Batch search for multiple items
 * Uses the client's queue to automatically rate-limit requests
 *
 * @param queries - Array of search queries
 * @param type - Optional item type filter
 * @returns Array of search results
 */
export async function batchSearchItems(
  queries: string[],
  type?: string
): Promise<ItemSearchResponse[]> {
  console.log(`Batch searching ${queries.length} items`)

  const promises = queries.map((query) => searchItems(query, type))

  return await Promise.all(promises)
}

/**
 * Batch get item details for multiple items
 * Uses the client's queue to automatically rate-limit requests
 *
 * @param hashedItemIds - Array of hashed item IDs
 * @returns Array of item details (null entries for failed requests)
 */
export async function batchGetItemDetails(
  hashedItemIds: string[]
): Promise<(ItemDetails | null)[]> {
  console.log(`Batch fetching details for ${hashedItemIds.length} items`)

  const promises = hashedItemIds.map((id) => getItemDetails(id))

  return await Promise.all(promises)
}

/**
 * Check authentication status and get API key information
 *
 * @returns API key information including name, scopes, and rate limit
 * @returns null if API key is not configured or authentication fails
 */
export async function checkAuth(): Promise<AuthCheckResponse | null> {
  // Check if API key is configured
  if (!apiClient.isConfigured()) {
    console.log('API key not configured, cannot check auth')
    return null
  }

  // Build cache key
  const cacheKey = generateCacheKey('/auth/check')

  // Check cache first (with short TTL for auth checks)
  const cached = get<AuthCheckResponse>(cacheKey)
  if (cached) {
    console.log('Cache hit for auth check')
    return cached
  }

  // Cache miss - make API request
  console.log('Cache miss for auth check, fetching from API')

  try {
    const data = await apiClient.get<AuthCheckResponse>('/auth/check')

    // Cache the result (5 minute TTL for auth info)
    set(cacheKey, data, 5 * 60 * 1000)

    return data
  } catch (error) {
    console.error('Failed to check auth, returning null:', error)
    return null
  }
}
