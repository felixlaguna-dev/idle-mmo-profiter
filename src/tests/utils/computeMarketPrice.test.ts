import { describe, it, expect, vi, afterEach } from 'vitest'
import { computeMarketPrice } from '../../utils/computeMarketPrice'
import type { LatestSoldEntry } from '../../api/services'

function makeSale(overrides: Partial<LatestSoldEntry> & { price_per_item: number; quantity: number; sold_at: string }): LatestSoldEntry {
  return {
    item: { hashed_id: 'test', name: 'Test Item', image_url: '...' },
    tier: 1,
    total_price: overrides.price_per_item * overrides.quantity,
    ...overrides,
  }
}

describe('computeMarketPrice', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null for empty array', () => {
    expect(computeMarketPrice([])).toBeNull()
  })

  it('computes VWAP from sales within last 24h', () => {
    const now = Date.now()
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString()
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString()

    const sales = [
      makeSale({ price_per_item: 100, quantity: 10, sold_at: oneHourAgo }),
      makeSale({ price_per_item: 200, quantity: 5, sold_at: twoHoursAgo }),
    ]

    // VWAP: (100*10 + 200*5) / (10+5) = 2000/15 ≈ 133.33
    expect(computeMarketPrice(sales)).toBeCloseTo(2000 / 15, 5)
  })

  it('weights by quantity correctly', () => {
    const now = Date.now()
    const recent = new Date(now - 60 * 1000).toISOString()

    const sales = [
      makeSale({ price_per_item: 50, quantity: 100, sold_at: recent }),
      makeSale({ price_per_item: 200, quantity: 1, sold_at: recent }),
    ]

    // VWAP: (50*100 + 200*1) / (100+1) = 5200/101 ≈ 51.49
    // The large-quantity sale at 50 dominates
    const result = computeMarketPrice(sales)!
    expect(result).toBeCloseTo(5200 / 101, 5)
    expect(result).toBeLessThan(60)
  })

  it('falls back to most recent sale when no sales in last 24h', () => {
    const oldTimestamp = '2024-01-01T00:00:00.000Z'

    const sales = [
      makeSale({ price_per_item: 150, quantity: 3, sold_at: oldTimestamp }),
      makeSale({ price_per_item: 100, quantity: 5, sold_at: '2023-12-31T00:00:00.000Z' }),
    ]

    // No sales in last 24h, fallback to first entry's price_per_item
    expect(computeMarketPrice(sales)).toBe(150)
  })

  it('only includes sales within the 24h window in VWAP', () => {
    const now = Date.now()
    const recent = new Date(now - 60 * 1000).toISOString()
    const oldTimestamp = '2024-01-01T00:00:00.000Z'

    const sales = [
      makeSale({ price_per_item: 100, quantity: 1, sold_at: recent }),
      makeSale({ price_per_item: 500, quantity: 100, sold_at: oldTimestamp }),
    ]

    // Only the recent sale should count for VWAP
    expect(computeMarketPrice(sales)).toBe(100)
  })

  it('handles single sale within 24h', () => {
    const now = Date.now()
    const recent = new Date(now - 60 * 1000).toISOString()

    const sales = [makeSale({ price_per_item: 42, quantity: 7, sold_at: recent })]

    // Single sale VWAP = price_per_item
    expect(computeMarketPrice(sales)).toBe(42)
  })
})
