/**
 * Tests for sales volume tier classification utility
 */

import { describe, it, expect } from 'vitest'
import { getVolumeTier, getVolumeTierInfo, VOLUME_TIER_CONFIG } from '../../utils/salesVolume'

describe('getVolumeTier', () => {
  describe('dead tier (0 units)', () => {
    it('should return dead for 0 units', () => {
      expect(getVolumeTier(0)).toBe('dead')
    })

    it('should return dead when volume is undefined', () => {
      expect(getVolumeTier(undefined)).toBe('dead')
    })
  })

  describe('trickle tier (1-9 units)', () => {
    it('should return trickle for 1 unit (boundary)', () => {
      expect(getVolumeTier(1)).toBe('trickle')
    })

    it('should return trickle for 9 units (max)', () => {
      expect(getVolumeTier(9)).toBe('trickle')
    })

    it('should return trickle for 5 units (mid-range)', () => {
      expect(getVolumeTier(5)).toBe('trickle')
    })
  })

  describe('moderate tier (10-49 units)', () => {
    it('should return moderate for 10 units (boundary)', () => {
      expect(getVolumeTier(10)).toBe('moderate')
    })

    it('should return moderate for 49 units (max)', () => {
      expect(getVolumeTier(49)).toBe('moderate')
    })

    it('should return moderate for 25 units (mid-range)', () => {
      expect(getVolumeTier(25)).toBe('moderate')
    })
  })

  describe('active tier (50-199 units)', () => {
    it('should return active for 50 units (boundary)', () => {
      expect(getVolumeTier(50)).toBe('active')
    })

    it('should return active for 199 units (max)', () => {
      expect(getVolumeTier(199)).toBe('active')
    })

    it('should return active for 100 units (mid-range)', () => {
      expect(getVolumeTier(100)).toBe('active')
    })
  })

  describe('hot tier (200+ units)', () => {
    it('should return hot for 200 units (boundary)', () => {
      expect(getVolumeTier(200)).toBe('hot')
    })

    it('should return hot for large numbers', () => {
      expect(getVolumeTier(1000)).toBe('hot')
      expect(getVolumeTier(10000)).toBe('hot')
      expect(getVolumeTier(999999)).toBe('hot')
    })
  })
})

describe('getVolumeTierInfo', () => {
  it('should return tier info with config for dead tier', () => {
    const info = getVolumeTierInfo(0)
    expect(info.tier).toBe('dead')
    expect(info.icon).toBe('○')
    expect(info.label).toBe('Dead')
    expect(info.volume).toBe(0)
    expect(info.tooltip).toBe('No sales this week')
  })

  it('should return tier info with config for trickle tier', () => {
    const info = getVolumeTierInfo(5)
    expect(info.tier).toBe('trickle')
    expect(info.icon).toBe('△')
    expect(info.label).toBe('Trickle')
    expect(info.volume).toBe(5)
    expect(info.tooltip).toBe('5 units sold this week (Trickle)')
  })

  it('should return tier info with config for moderate tier', () => {
    const info = getVolumeTierInfo(25)
    expect(info.tier).toBe('moderate')
    expect(info.icon).toBe('▲')
    expect(info.label).toBe('Moderate')
    expect(info.volume).toBe(25)
    expect(info.tooltip).toBe('25 units sold this week (Moderate)')
  })

  it('should return tier info with config for active tier', () => {
    const info = getVolumeTierInfo(100)
    expect(info.tier).toBe('active')
    expect(info.icon).toBe('●')
    expect(info.label).toBe('Active')
    expect(info.volume).toBe(100)
    expect(info.tooltip).toBe('100 units sold this week (Active)')
  })

  it('should return tier info with config for hot tier', () => {
    const info = getVolumeTierInfo(500)
    expect(info.tier).toBe('hot')
    expect(info.icon).toBe('🔥')
    expect(info.label).toBe('Hot')
    expect(info.volume).toBe(500)
    expect(info.tooltip).toBe('500 units sold this week (Hot)')
  })

  it('should handle undefined volume gracefully', () => {
    const info = getVolumeTierInfo(undefined)
    expect(info.tier).toBe('dead')
    expect(info.volume).toBe(0)
    expect(info.tooltip).toBe('No sales this week')
  })

  it('should return all config properties from VOLUME_TIER_CONFIG', () => {
    const info = getVolumeTierInfo(100)
    expect(info.min).toBe(VOLUME_TIER_CONFIG.active.min)
    expect(info.max).toBe(VOLUME_TIER_CONFIG.active.max)
    expect(info.color).toBe(VOLUME_TIER_CONFIG.active.color)
  })
})

describe('VOLUME_TIER_CONFIG', () => {
  it('should export correct thresholds for dead tier', () => {
    expect(VOLUME_TIER_CONFIG.dead.min).toBe(0)
    expect(VOLUME_TIER_CONFIG.dead.max).toBe(0)
  })

  it('should export correct thresholds for trickle tier', () => {
    expect(VOLUME_TIER_CONFIG.trickle.min).toBe(1)
    expect(VOLUME_TIER_CONFIG.trickle.max).toBe(9)
  })

  it('should export correct thresholds for moderate tier', () => {
    expect(VOLUME_TIER_CONFIG.moderate.min).toBe(10)
    expect(VOLUME_TIER_CONFIG.moderate.max).toBe(49)
  })

  it('should export correct thresholds for active tier', () => {
    expect(VOLUME_TIER_CONFIG.active.min).toBe(50)
    expect(VOLUME_TIER_CONFIG.active.max).toBe(199)
  })

  it('should export correct thresholds for hot tier', () => {
    expect(VOLUME_TIER_CONFIG.hot.min).toBe(200)
    expect(VOLUME_TIER_CONFIG.hot.max).toBe(Infinity)
  })

  it('should export all required properties for each tier', () => {
    const tiers = ['dead', 'trickle', 'moderate', 'active', 'hot'] as const
    tiers.forEach((tier) => {
      const config = VOLUME_TIER_CONFIG[tier]
      expect(config).toHaveProperty('min')
      expect(config).toHaveProperty('max')
      expect(config).toHaveProperty('label')
      expect(config).toHaveProperty('icon')
      expect(config).toHaveProperty('tooltip')
      expect(config).toHaveProperty('color')
    })
  })
})
