/**
 * Tests for API service response handling
 * These tests verify that the service layer correctly handles real API response formats
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchItems, getAverageMarketPrice, inspectItem } from '../../api/services'
import { apiClient } from '../../api/client'
import * as cache from '../../api/cache'

// Mock the API client
vi.mock('../../api/client', () => ({
  apiClient: {
    isConfigured: vi.fn(),
    get: vi.fn(),
  },
}))

// Mock the cache
vi.mock('../../api/cache', () => ({
  get: vi.fn(),
  set: vi.fn(),
  generateCacheKey: vi.fn((path: string, params?: Record<string, unknown>) => {
    if (!params) return path
    return `${path}?${new URLSearchParams(params as Record<string, string>).toString()}`
  }),
  invalidate: vi.fn(),
}))

describe('API Services - Real Response Formats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: API is configured
    vi.mocked(apiClient.isConfigured).mockReturnValue(true)
    // Default: cache misses
    vi.mocked(cache.get).mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('searchItems', () => {
    it('should handle real API response with items array and hashed_id field', async () => {
      // This is the ACTUAL response format from IdleMMO API
      const mockApiResponse = {
        items: [
          {
            hashed_id: 'abc123def456',
            name: 'Moose antler',
            description: 'A large antler from a moose.',
            image_url: 'https://cdn.idle-mmo.com/images/moose-antler.png',
            type: 'material',
            quality: 'COMMON',
            vendor_price: 50,
          },
        ],
        pagination: {
          current_page: 1,
          last_page: 1,
          per_page: 20,
          total: 1,
          from: 1,
          to: 1,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const result = await searchItems('Moose antler')

      // Verify the response is returned correctly
      expect(result).toEqual(mockApiResponse)
      expect(result.items).toBeDefined()
      expect(result.items.length).toBe(1)
      expect(result.items[0].hashed_id).toBe('abc123def456')
      expect(result.items[0].name).toBe('Moose antler')
      expect(result.items[0].vendor_price).toBe(50)
    })
  })

  describe('inspectItem', () => {
    it('should handle real API response with wrapped item object', async () => {
      // This is the ACTUAL response format from IdleMMO API
      const mockApiResponse = {
        item: {
          hashed_id: 'abc123def456',
          name: 'Bow',
          vendor_price: 100,
          is_tradeable: true,
          max_tier: 5,
        },
        endpoint_updates_at: '2025-12-21T13:30:00.000000Z',
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const result = await inspectItem('abc123def456')

      // The service should extract the 'item' property
      expect(result).toBeDefined()
      expect(result?.hashed_id).toBe('abc123def456')
      expect(result?.vendor_price).toBe(100)
    })
  })

  describe('getAverageMarketPrice', () => {
    it('should compute VWAP from recent sales within last 24h', async () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString()

      const mockApiResponse = {
        history_data: [],
        latest_sold: [
          {
            item: { hashed_id: 'abc123', name: 'Iron Sword', image_url: '...' },
            tier: 3,
            quantity: 5,
            price_per_item: 150,
            total_price: 750,
            sold_at: oneHourAgo,
          },
          {
            item: { hashed_id: 'abc123', name: 'Iron Sword', image_url: '...' },
            tier: 3,
            quantity: 2,
            price_per_item: 100,
            total_price: 200,
            sold_at: twoHoursAgo,
          },
        ],
        type: 'listings',
        endpoint_updates_at: now.toISOString(),
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const result = await getAverageMarketPrice('abc123')

      // VWAP: (150*5 + 100*2) / (5+2) = 950/7 ≈ 135.71
      expect(result).toBeCloseTo(950 / 7, 5)
    })

    it('should fall back to most recent sale when no sales in last 24h', async () => {
      const mockApiResponse = {
        history_data: [],
        latest_sold: [
          {
            item: { hashed_id: 'abc123', name: 'Iron Sword', image_url: '...' },
            tier: 3,
            quantity: 5,
            price_per_item: 150,
            total_price: 750,
            sold_at: '2025-01-16T14:30:00.000000Z',
          },
          {
            item: { hashed_id: 'abc123', name: 'Iron Sword', image_url: '...' },
            tier: 3,
            quantity: 2,
            price_per_item: 100,
            total_price: 200,
            sold_at: '2025-01-16T14:00:00.000000Z',
          },
        ],
        type: 'listings',
        endpoint_updates_at: '2025-01-16T15:00:00.000000Z',
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const result = await getAverageMarketPrice('abc123')

      // No sales in last 24h, fallback to most recent sale price
      expect(result).toBe(150)
    })

    it('should return null when no latest_sold data', async () => {
      const mockApiResponse = {
        history_data: [],
        latest_sold: [],
        type: 'listings',
        endpoint_updates_at: '2025-01-16T15:00:00.000000Z',
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const result = await getAverageMarketPrice('abc123')

      expect(result).toBeNull()
    })
  })
})
