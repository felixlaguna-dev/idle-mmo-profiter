/**
 * Utility functions for detecting low-confidence prices
 *
 * A price is considered "low-confidence" if the item hasn't been sold recently.
 * This helps users identify items where the market price may be stale or unreliable.
 */

/** Number of days without sales to consider a price low-confidence */
export const LOW_CONFIDENCE_THRESHOLD_DAYS = 30

/** Number of milliseconds in a day */
export const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Check if a lastSaleAt timestamp indicates a low-confidence price.
 * A price is low-confidence if there's no sale data or the last sale was >30 days ago.
 *
 * @param lastSaleAt - ISO timestamp of the last sale, or undefined if no sales
 * @returns true if the price is considered low-confidence
 */
export function isLowConfidence(lastSaleAt?: string): boolean {
  if (!lastSaleAt) {
    return true // No sale data = low confidence
  }
  const lastSaleTime = new Date(lastSaleAt).getTime()
  const now = Date.now()
  const daysSinceLastSale = (now - lastSaleTime) / MS_PER_DAY
  return daysSinceLastSale > LOW_CONFIDENCE_THRESHOLD_DAYS
}
