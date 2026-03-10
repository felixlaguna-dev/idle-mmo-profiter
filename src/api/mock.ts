/**
 * Mock Data Provider for Development Without API Key
 *
 * This module provides a unified data provider interface that works
 * identically with or without an API key by falling back to defaults.json.
 *
 * DataProvider interface abstracts data access:
 * - MockProvider: Returns data from defaults.json
 * - ApiProvider: Returns data from API with cache/defaults fallback
 *
 * CRITICAL: App must work 100% without API key using default data
 */

import { apiClient } from './client'
import { getAge, generateCacheKey } from './cache'
import {
  searchItems,
  getItemDetails,
  getMarketHistory,
  getMarketPrices,
  getAverageMarketPrice,
  checkAuth,
  type ItemSearchResponse,
  type ItemDetails,
  type MarketHistoryResponse,
} from './services'
import defaultData from '../data/defaults.json'
import type { DefaultData, AuthCheckResponse } from '../types'

/**
 * Data source status
 */
export interface DataProviderStatus {
  isUsingApi: boolean
  apiConfigured: boolean
  lastApiUpdate: number | null // Unix timestamp in milliseconds
  message: string
}

/**
 * Unified data provider interface
 * Both MockProvider and ApiProvider implement this interface
 */
export interface DataProvider {
  /**
   * Get current status of the data provider
   */
  getStatus(): DataProviderStatus

  /**
   * Get current prices for all items
   * Returns either API prices or default prices from defaults.json
   */
  getCurrentPrices(): Promise<DefaultData>

  /**
   * Get detailed item information by name
   * Returns either API item details or default data
   */
  getItemDetails(name: string): Promise<ItemDetails | null>

  /**
   * Search for items
   * Returns either API search results or filtered defaults
   */
  searchItems(query?: string, type?: string, page?: number): Promise<ItemSearchResponse>

  /**
   * Get market history for an item
   * Returns either API market data or empty history
   */
  getMarketHistory(
    hashedItemId: string,
    tier?: number,
    type?: 'listings' | 'orders'
  ): Promise<MarketHistoryResponse>

  /**
   * Get market prices (buy/sell) for an item
   * Returns either API prices or null
   */
  getMarketPrices(
    hashedItemId: string,
    tier?: number
  ): Promise<{ buyPrice: number | null; sellPrice: number | null }>

  /**
   * Get average market price from recent history
   * Returns either API average or null
   */
  getAverageMarketPrice(hashedItemId: string, tier?: number): Promise<number | null>

  /**
   * Check authentication status
   * Returns null if using mock data
   */
  checkAuth(): Promise<AuthCheckResponse | null>
}

/**
 * Mock data provider that always returns data from defaults.json
 * Used when no API key is configured
 */
export class MockProvider implements DataProvider {
  private defaults: DefaultData

  constructor() {
    this.defaults = defaultData as DefaultData
  }

  getStatus(): DataProviderStatus {
    return {
      isUsingApi: false,
      apiConfigured: false,
      lastApiUpdate: null,
      message: 'Offline data',
    }
  }

  async getCurrentPrices(): Promise<DefaultData> {
    return this.defaults
  }

  async getItemDetails(name: string): Promise<ItemDetails | null> {
    // Try to find item in defaults by name
    // Search materials, potions, resources
    const material = this.defaults.materials.find(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    )
    const craftable = this.defaults.craftables.find(
      (p) => p.name.toLowerCase() === name.toLowerCase()
    )
    const resource = this.defaults.resources.find(
      (r) => r.name.toLowerCase() === name.toLowerCase()
    )

    if (material) {
      return {
        hashed_id: material.id,
        name: material.name,
        vendor_price: material.price,
        is_tradeable: true,
        max_tier: 5,
        description: `Material: ${material.name}`,
        type: 'material',
      }
    }

    if (craftable) {
      return {
        hashed_id: craftable.id,
        name: craftable.name,
        vendor_price: craftable.price,
        is_tradeable: true,
        max_tier: 5,
        description: `Craftable: ${craftable.name}`,
        type: 'craftable',
      }
    }

    if (resource) {
      return {
        hashed_id: resource.id,
        name: resource.name,
        vendor_price: resource.marketPrice,
        is_tradeable: true,
        max_tier: 5,
        description: `Resource: ${resource.name}`,
        type: 'resource',
      }
    }

    return null
  }

  async searchItems(query?: string, type?: string, page = 1): Promise<ItemSearchResponse> {
    // Combine all items from defaults
    const allItems: Array<{ id: string; name: string; type: string; price: number }> = [
      ...this.defaults.materials.map((m) => ({ ...m, type: 'material' })),
      ...this.defaults.craftables.map((p) => ({ ...p, type: 'craftable' })),
      ...this.defaults.resources.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'resource',
        price: r.marketPrice,
      })),
    ]

    // Filter by query and type
    let filtered = allItems
    if (query) {
      const lowerQuery = query.toLowerCase()
      filtered = filtered.filter((item) => item.name.toLowerCase().includes(lowerQuery))
    }
    if (type) {
      filtered = filtered.filter((item) => item.type === type)
    }

    // Pagination
    const perPage = 25
    const start = (page - 1) * perPage
    const end = start + perPage
    const paginatedItems = filtered.slice(start, end)

    return {
      items: paginatedItems.map((item) => ({
        hashed_id: item.id,
        name: item.name,
        description: `${item.type}: ${item.name}`,
        image_url: '',
        type: item.type,
        quality: 'COMMON',
        vendor_price: 0,
      })),
      pagination: {
        current_page: page,
        last_page: Math.ceil(filtered.length / perPage),
        per_page: perPage,
        total: filtered.length,
        from: start + 1,
        to: Math.min(end, filtered.length),
      },
    }
  }

  async getMarketHistory(): Promise<MarketHistoryResponse> {
    return {
      history_data: [],
      latest_sold: [],
      type: 'listings',
      endpoint_updates_at: new Date().toISOString(),
    }
  }

  async getMarketPrices(): Promise<{ buyPrice: number | null; sellPrice: number | null }> {
    return { buyPrice: null, sellPrice: null }
  }

  async getAverageMarketPrice(): Promise<number | null> {
    return null
  }

  async checkAuth(): Promise<AuthCheckResponse | null> {
    return null
  }
}

/**
 * API data provider that uses the API services with cache/defaults fallback
 * Used when API key is configured
 */
export class ApiProvider implements DataProvider {
  private defaults: DefaultData

  constructor() {
    this.defaults = defaultData as DefaultData
  }

  getStatus(): DataProviderStatus {
    const apiConfigured = apiClient.isConfigured()
    if (!apiConfigured) {
      return {
        isUsingApi: false,
        apiConfigured: false,
        lastApiUpdate: null,
        message: 'Offline data',
      }
    }

    // Try to get last update time from cache
    // Check a common cache key (item search page 1)
    const cacheKey = generateCacheKey('/item/search', { page: 1 })
    const cacheAge = getAge(cacheKey)

    if (cacheAge !== null) {
      const minutesAgo = Math.floor(cacheAge / 1000 / 60)
      return {
        isUsingApi: true,
        apiConfigured: true,
        lastApiUpdate: Date.now() - cacheAge,
        message: `Using live API data (last updated ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago)`,
      }
    }

    return {
      isUsingApi: true,
      apiConfigured: true,
      lastApiUpdate: null,
      message: 'Using live API data (no cached data yet)',
    }
  }

  async getCurrentPrices(): Promise<DefaultData> {
    // If API is not configured, return defaults
    if (!apiClient.isConfigured()) {
      return this.defaults
    }

    // Try to get data from API cache
    // For now, return defaults since we don't have a bulk price endpoint
    // In the future, this could aggregate data from multiple API calls
    return this.defaults
  }

  async getItemDetails(name: string): Promise<ItemDetails | null> {
    // If API is not configured, fall back to mock provider
    if (!apiClient.isConfigured()) {
      const mockProvider = new MockProvider()
      return mockProvider.getItemDetails(name)
    }

    // First, search for the item to get its hashed ID
    const searchResults = await searchItems(name)
    if (!searchResults.items || searchResults.items.length === 0) {
      // Fall back to defaults
      const mockProvider = new MockProvider()
      return mockProvider.getItemDetails(name)
    }

    // Find exact match
    const item = searchResults.items.find(
      (i: { name: string }) => i.name.toLowerCase() === name.toLowerCase()
    )

    if (!item) {
      // Fall back to defaults
      const mockProvider = new MockProvider()
      return mockProvider.getItemDetails(name)
    }

    // Get detailed item info
    return getItemDetails(item.hashed_id)
  }

  async searchItems(query?: string, type?: string, page = 1): Promise<ItemSearchResponse> {
    return searchItems(query, type, page)
  }

  async getMarketHistory(
    hashedItemId: string,
    tier?: number,
    type?: 'listings' | 'orders'
  ): Promise<MarketHistoryResponse> {
    return getMarketHistory(hashedItemId, tier, type)
  }

  async getMarketPrices(
    hashedItemId: string,
    tier?: number
  ): Promise<{ buyPrice: number | null; sellPrice: number | null }> {
    return getMarketPrices(hashedItemId, tier)
  }

  async getAverageMarketPrice(
    hashedItemId: string,
    tier?: number
  ): Promise<number | null> {
    return getAverageMarketPrice(hashedItemId, tier)
  }

  async checkAuth(): Promise<AuthCheckResponse | null> {
    return checkAuth()
  }
}

/**
 * Factory function to create the appropriate data provider
 * Returns MockProvider if no API key, ApiProvider otherwise
 */
export function createDataProvider(): DataProvider {
  if (apiClient.isConfigured()) {
    return new ApiProvider()
  }
  return new MockProvider()
}

/**
 * Global data provider instance (singleton)
 * This is the recommended way to access data throughout the app
 */
let globalDataProvider: DataProvider | null = null

/**
 * Get the global data provider instance
 * Automatically switches between Mock and API providers based on configuration
 */
export function getDataProvider(): DataProvider {
  if (!globalDataProvider) {
    globalDataProvider = createDataProvider()
  }
  return globalDataProvider
}

/**
 * Reset the global data provider
 * Useful when API key changes or for testing
 */
export function resetDataProvider(): void {
  globalDataProvider = null
}

/**
 * Get current data provider status
 * Convenience function for checking status without getting full provider
 */
export function getDataProviderStatus(): DataProviderStatus {
  return getDataProvider().getStatus()
}
