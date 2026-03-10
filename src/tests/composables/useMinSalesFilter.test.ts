/**
 * Tests for useMinSalesFilter composable
 *
 * NOTE: The composable uses a module-level singleton pattern.
 * Each test must explicitly reset state before testing.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useMinSalesFilter } from '../../composables/useMinSalesFilter'

describe('useMinSalesFilter', () => {
  // Get the singleton instance and reset state before each test
  const filter = useMinSalesFilter()

  beforeEach(async () => {
    // Reset threshold to default (10) before each test
    filter.setMinSalesThreshold(10)
    await nextTick()
  })

  describe('initial state', () => {
    it('should have threshold default to 10', async () => {
      const { minSalesThreshold } = useMinSalesFilter()

      await nextTick()

      expect(minSalesThreshold.value).toBe(10)
    })
  })

  describe('threshold setter', () => {
    it('should update threshold via setter', async () => {
      const { minSalesThreshold, setMinSalesThreshold } = useMinSalesFilter()

      expect(minSalesThreshold.value).toBe(10)

      setMinSalesThreshold(25)
      await nextTick()

      expect(minSalesThreshold.value).toBe(25)
    })

    it('should allow setting threshold to 0', async () => {
      const { minSalesThreshold, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(0)
      await nextTick()

      expect(minSalesThreshold.value).toBe(0)
    })

    it('should allow large threshold values', async () => {
      const { minSalesThreshold, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(1000)
      await nextTick()

      expect(minSalesThreshold.value).toBe(1000)
    })
  })

  describe('filterBySalesVolume', () => {
    it('should filter out items below threshold', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(10)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 5 },
        { name: 'Item 2', weeklySalesVolume: 10 },
        { name: 'Item 3', weeklySalesVolume: 15 },
        { name: 'Item 4', weeklySalesVolume: 3 },
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(2)
      expect(result.map((i) => i.name)).toEqual(['Item 2', 'Item 3'])
    })

    it('should include items at exactly the threshold', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(10)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 9 },
        { name: 'Item 2', weeklySalesVolume: 10 },
        { name: 'Item 3', weeklySalesVolume: 11 },
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(2)
      expect(result.map((i) => i.name)).toEqual(['Item 2', 'Item 3'])
    })

    it('should pass through items with undefined weeklySalesVolume', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(10)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 5 }, // Below threshold - excluded
        { name: 'Item 2', weeklySalesVolume: undefined }, // Undefined - included
        { name: 'Item 3', weeklySalesVolume: 15 }, // Above threshold - included
        { name: 'Item 4' }, // No field - included
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(3)
      expect(result.map((i) => i.name)).toEqual(['Item 2', 'Item 3', 'Item 4'])
    })

    it('should include all items when threshold is 0', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(0)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 0 },
        { name: 'Item 2', weeklySalesVolume: 1 },
        { name: 'Item 3', weeklySalesVolume: 100 },
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(3)
      expect(result.map((i) => i.name)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    })

    it('should filter correctly with high threshold', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(100)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 50 },
        { name: 'Item 2', weeklySalesVolume: 99 },
        { name: 'Item 3', weeklySalesVolume: 100 },
        { name: 'Item 4', weeklySalesVolume: 150 },
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(2)
      expect(result.map((i) => i.name)).toEqual(['Item 3', 'Item 4'])
    })

    it('should return empty array when all items are below threshold', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(100)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 10 },
        { name: 'Item 2', weeklySalesVolume: 20 },
        { name: 'Item 3', weeklySalesVolume: 50 },
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(0)
    })

    it('should handle mixed defined and undefined volumes', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(10)
      await nextTick()

      const items = [
        { name: 'Resource', weeklySalesVolume: undefined }, // Resources - included
        { name: 'Low Volume', weeklySalesVolume: 5 }, // Below threshold - excluded
        { name: 'Medium Volume', weeklySalesVolume: 15 }, // Above threshold - included
        { name: 'Another Resource' }, // No field - included
        { name: 'High Volume', weeklySalesVolume: 100 }, // Above threshold - included
      ]

      const result = filterBySalesVolume(items)

      expect(result).toHaveLength(4)
      expect(result.map((i) => i.name)).toEqual([
        'Resource',
        'Medium Volume',
        'Another Resource',
        'High Volume',
      ])
    })
  })

  describe('persistence', () => {
    it('should persist threshold to localStorage', async () => {
      const { setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(25)
      await nextTick()

      // Check that localStorage was updated
      const stored = localStorage.getItem('idlemmo:min-sales-filter')
      expect(stored).not.toBeNull()

      const parsed = JSON.parse(stored!)
      expect(parsed.minSalesThreshold).toBe(25)
    })
  })

  describe('singleton behavior', () => {
    it('should share state between multiple calls', async () => {
      const instance1 = useMinSalesFilter()
      const instance2 = useMinSalesFilter()

      instance1.setMinSalesThreshold(50)
      await nextTick()

      expect(instance2.minSalesThreshold.value).toBe(50)
    })

    it('should maintain consistent filtering across instances', async () => {
      const instance1 = useMinSalesFilter()
      const instance2 = useMinSalesFilter()

      instance1.setMinSalesThreshold(20)
      await nextTick()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 10 },
        { name: 'Item 2', weeklySalesVolume: 30 },
      ]

      const result1 = instance1.filterBySalesVolume(items)
      const result2 = instance2.filterBySalesVolume(items)

      expect(result1).toEqual(result2)
      expect(result1).toHaveLength(1)
      expect(result1[0].name).toBe('Item 2')
    })
  })

  describe('reactive updates', () => {
    it('should update filtering when threshold changes', async () => {
      const { filterBySalesVolume, setMinSalesThreshold } = useMinSalesFilter()

      const items = [
        { name: 'Item 1', weeklySalesVolume: 5 },
        { name: 'Item 2', weeklySalesVolume: 15 },
        { name: 'Item 3', weeklySalesVolume: 25 },
      ]

      // Set threshold to 10
      setMinSalesThreshold(10)
      await nextTick()

      let result = filterBySalesVolume(items)
      expect(result).toHaveLength(2)
      expect(result.map((i) => i.name)).toEqual(['Item 2', 'Item 3'])

      // Increase threshold to 20
      setMinSalesThreshold(20)
      await nextTick()

      result = filterBySalesVolume(items)
      expect(result).toHaveLength(1)
      expect(result.map((i) => i.name)).toEqual(['Item 3'])

      // Decrease threshold to 0
      setMinSalesThreshold(0)
      await nextTick()

      result = filterBySalesVolume(items)
      expect(result).toHaveLength(3)
      expect(result.map((i) => i.name)).toEqual(['Item 1', 'Item 2', 'Item 3'])
    })
  })
})
