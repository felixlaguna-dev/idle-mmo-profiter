import type { LatestSoldEntry } from '../api/services'

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000

/**
 * Compute market price as VWAP of sales within the last 24 hours.
 * Falls back to the most recent sale's price if no sales in that window.
 * Returns null if there are no sales at all.
 */
export function computeMarketPrice(latestSold: LatestSoldEntry[]): number | null {
  if (latestSold.length === 0) return null

  const now = Date.now()

  const recentSales = latestSold.filter(
    (entry) => now - new Date(entry.sold_at).getTime() <= TWENTY_FOUR_HOURS_MS
  )

  if (recentSales.length > 0) {
    const totalValue = recentSales.reduce((acc, e) => acc + e.price_per_item * e.quantity, 0)
    const totalQty = recentSales.reduce((acc, e) => acc + e.quantity, 0)
    return totalValue / totalQty
  }

  // Fallback: most recent sale ever (latest_sold is sorted most recent first)
  return latestSold[0].price_per_item
}
