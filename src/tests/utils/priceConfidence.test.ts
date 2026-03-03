/**
 * Tests for price confidence utility functions
 */

import { describe, it, expect } from 'vitest'
import { isLowConfidence, LOW_CONFIDENCE_THRESHOLD_DAYS, MS_PER_DAY } from '../../utils/priceConfidence'

describe('isLowConfidence', () => {
  describe('no sales data', () => {
    it('should return true when lastSaleAt is undefined', () => {
      expect(isLowConfidence(undefined)).toBe(true)
    })

    it('should return true when lastSaleAt is empty string', () => {
      expect(isLowConfidence('')).toBe(true)
    })
  })

  describe('recent sales', () => {
    it('should return false when there is a recent sale (within 30 days)', () => {
      const now = Date.now()
      const sevenDaysAgo = new Date(now - 7 * MS_PER_DAY).toISOString()
      expect(isLowConfidence(sevenDaysAgo)).toBe(false)
    })

    it('should return false for sales exactly at 30 days threshold', () => {
      const now = Date.now()
      const exactlyThirtyDays = new Date(now - 30 * MS_PER_DAY).toISOString()
      // Exactly 30 days should NOT be low confidence (it's the boundary)
      expect(isLowConfidence(exactlyThirtyDays)).toBe(false)
    })

    it('should return false for sales just under 30 days', () => {
      const now = Date.now()
      const justUnderThirtyDays = new Date(now - 29.5 * MS_PER_DAY).toISOString()
      expect(isLowConfidence(justUnderThirtyDays)).toBe(false)
    })
  })

  describe('old sales', () => {
    it('should return true when sale is older than 30 days', () => {
      const now = Date.now()
      const thirtyFiveDaysAgo = new Date(now - 35 * MS_PER_DAY).toISOString()
      expect(isLowConfidence(thirtyFiveDaysAgo)).toBe(true)
    })

    it('should return true when sale is much older', () => {
      const now = Date.now()
      const oneHundredEightyDaysAgo = new Date(now - 180 * MS_PER_DAY).toISOString()
      expect(isLowConfidence(oneHundredEightyDaysAgo)).toBe(true)
    })

    it('should return true when sale is just over 30 days', () => {
      const now = Date.now()
      const justOverThirtyDays = new Date(now - 30.1 * MS_PER_DAY).toISOString()
      expect(isLowConfidence(justOverThirtyDays)).toBe(true)
    })
  })
})

describe('constants', () => {
  it('should export LOW_CONFIDENCE_THRESHOLD_DAYS as 30', () => {
    expect(LOW_CONFIDENCE_THRESHOLD_DAYS).toBe(30)
  })

  it('should export MS_PER_DAY as correct milliseconds value', () => {
    expect(MS_PER_DAY).toBe(24 * 60 * 60 * 1000)
  })
})
