/**
 * Composable for heatmap coloring based on profit values.
 *
 * Provides functions to calculate heatmap colors for profit cells in tables.
 * - Deep green for high profit
 * - Light green for moderate profit
 * - Yellow for low/break-even profit
 * - Red for negative profit
 */

export interface HeatmapStyle extends Record<string, string> {
  backgroundColor: string
  color: string
}

/**
 * Calculate heatmap color for a profit value.
 *
 * @param profit - The profit value
 * @param minProfit - The minimum profit in the dataset
 * @param maxProfit - The maximum profit in the dataset
 * @returns Style object with backgroundColor and text color
 */
export function getHeatmapStyle(
  profit: number,
  minProfit: number,
  maxProfit: number
): HeatmapStyle {
  // Handle negative profits - use red gradient
  if (profit < 0) {
    const minNegative = Math.min(minProfit, 0)
    const normalized = minNegative === 0 ? 1 : Math.abs(profit / minNegative)
    const intensity = Math.min(normalized, 1)

    // Red gradient: lighter to darker red — capped at 0.12 alpha for contrast
    const r = 239
    const g = Math.round(68 - 20 * intensity)
    const b = Math.round(68 - 20 * intensity)
    const alpha = 0.05 + intensity * 0.07

    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})`,
      color: '#fca5a5', // Lighter red for WCAG AA contrast on dark backgrounds
    }
  }

  // Handle zero or near-zero positive profits - use yellow
  if (profit <= 0 || profit < maxProfit * 0.02) {
    return {
      backgroundColor: 'rgba(234, 179, 8, 0.1)',
      color: '#eab308', // Yellow text
    }
  }

  // Handle positive profits - use continuous green gradient
  // Power scale (exponent 0.3) spreads values much better than linear or log
  // when max >> min (e.g., 17M max vs 440K min: linear=0.026, log=0.78, pow0.3=0.30)
  const linear = maxProfit === 0 ? 1 : profit / maxProfit
  const normalized = Math.pow(Math.max(linear, 0), 0.3)

  // Continuous alpha: 0.04 (lowest) to 0.16 (highest) — subtle to avoid visual clash
  const alpha = 0.04 + normalized * 0.12
  const textColor = normalized > 0.5 ? '#10a37f' : '#10b981'

  return {
    backgroundColor: `rgba(16, 185, 129, ${alpha.toFixed(3)})`,
    color: textColor,
  }
}

/**
 * Calculate heatmap class based on profit value.
 *
 * @param profit - The profit value
 * @param minProfit - The minimum profit in the dataset
 * @param maxProfit - The maximum profit in the dataset
 * @returns CSS class name for heatmap styling
 */
export function getHeatmapClass(profit: number, minProfit: number, maxProfit: number): string {
  if (profit < 0) {
    return 'heatmap-negative'
  }

  if (profit < maxProfit * 0.1) {
    return 'heatmap-low'
  }

  const range = maxProfit - minProfit
  const normalized = range === 0 ? 1 : (profit - minProfit) / range

  if (normalized < 0.33) {
    return 'heatmap-medium-low'
  } else if (normalized < 0.66) {
    return 'heatmap-medium-high'
  } else {
    return 'heatmap-high'
  }
}

/**
 * Use heatmap functionality in a component.
 *
 * @returns Object with heatmap utility functions
 */
/**
 * Get a subdued heatmap style (half intensity) for secondary profit columns.
 */
export function getSubduedHeatmapStyle(
  profit: number,
  minProfit: number,
  maxProfit: number
): HeatmapStyle {
  const style = getHeatmapStyle(profit, minProfit, maxProfit)
  // Halve the background alpha for a softer look
  const match = style.backgroundColor.match(/rgba?\(([^)]+)\)/)
  if (match) {
    const parts = match[1].split(',').map((s) => s.trim())
    if (parts.length === 4) {
      const alpha = parseFloat(parts[3]) * 0.5
      style.backgroundColor = `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha.toFixed(3)})`
    }
  }
  return style
}

export function useHeatmap() {
  return {
    getHeatmapStyle,
    getHeatmapClass,
    getSubduedHeatmapStyle,
  }
}
