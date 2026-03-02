import { describe, it, expect } from 'vitest'

// Type matching the implementation
type ItemCategory = 'materials' | 'craftables' | 'resources' | 'recipes'

// Helper functions matching the implementation
const shouldShowProfitSpread = (category: ItemCategory): boolean => {
  return category === 'materials' || category === 'resources'
}

const formatGoldProfit = (marketPrice: number, vendorValue?: number): string => {
  if (!vendorValue || vendorValue <= 0 || marketPrice <= 0) return '—'
  const profit = marketPrice - vendorValue
  if (profit === 0) return '—'
  return profit.toLocaleString()
}

const formatSpread = (marketPrice: number, vendorValue?: number): string => {
  if (!vendorValue || vendorValue <= 0 || marketPrice <= 0) return '—'
  const pct = ((marketPrice - vendorValue) / vendorValue) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

const formatGoldProfitForCategory = (category: ItemCategory, marketPrice: number, vendorValue?: number): string => {
  if (!shouldShowProfitSpread(category)) return 'N/A'
  return formatGoldProfit(marketPrice, vendorValue)
}

const formatSpreadForCategory = (category: ItemCategory, marketPrice: number, vendorValue?: number): string => {
  if (!shouldShowProfitSpread(category)) return 'N/A'
  return formatSpread(marketPrice, vendorValue)
}

describe('MarketTable - Category-aware Profit/Spread Display', () => {
  describe('shouldShowProfitSpread', () => {
    it('should return true for materials', () => {
      expect(shouldShowProfitSpread('materials')).toBe(true)
    })

    it('should return true for resources', () => {
      expect(shouldShowProfitSpread('resources')).toBe(true)
    })

    it('should return false for craftables', () => {
      expect(shouldShowProfitSpread('craftables')).toBe(false)
    })

    it('should return false for recipes', () => {
      expect(shouldShowProfitSpread('recipes')).toBe(false)
    })
  })

  describe('formatGoldProfitForCategory', () => {
    it('should return N/A for craftables', () => {
      expect(formatGoldProfitForCategory('craftables', 200, 80)).toBe('N/A')
    })

    it('should return N/A for recipes', () => {
      expect(formatGoldProfitForCategory('recipes', 300, 100)).toBe('N/A')
    })

    it('should return actual profit value for materials', () => {
      expect(formatGoldProfitForCategory('materials', 100, 50)).toBe('50')
    })

    it('should return actual profit value for resources', () => {
      expect(formatGoldProfitForCategory('resources', 150, 60)).toBe('90')
    })

    it('should return dash when vendor value is missing for materials', () => {
      expect(formatGoldProfitForCategory('materials', 100, undefined)).toBe('—')
    })
  })

  describe('formatSpreadForCategory', () => {
    it('should return N/A for craftables', () => {
      expect(formatSpreadForCategory('craftables', 200, 80)).toBe('N/A')
    })

    it('should return N/A for recipes', () => {
      expect(formatSpreadForCategory('recipes', 300, 100)).toBe('N/A')
    })

    it('should return actual spread percentage for materials', () => {
      // (100-50)/50 * 100 = +100%
      expect(formatSpreadForCategory('materials', 100, 50)).toBe('+100%')
    })

    it('should return actual spread percentage for resources', () => {
      // (150-60)/60 * 100 = +150%
      expect(formatSpreadForCategory('resources', 150, 60)).toBe('+150%')
    })

    it('should return dash when vendor value is missing for resources', () => {
      expect(formatSpreadForCategory('resources', 150, undefined)).toBe('—')
    })
  })
})
