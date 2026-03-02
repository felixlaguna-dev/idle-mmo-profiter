import { describe, it, expect } from 'vitest'
import { rankAllActivities, getBestAction } from '../../calculators/profitRanker'
import type { DungeonProfitResult } from '../../calculators/dungeonCalculator'
import type { CraftableProfitResult } from '../../calculators/craftableCalculator'
import type { ResourceProfitResult } from '../../calculators/resourceCalculator'

describe('profitRanker', () => {
  describe('rankAllActivities', () => {
    it('should include saleMethod for resource activities', () => {
      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'Oak Log',
          timeSeconds: 10,
          cost: 5,
          vendorValue: 10,
          marketPrice: 15,
          vendorProfit: 5,
          vendorProfitPerHour: 1800,
          marketProfit: 10,
          marketProfitPerHour: 3600,
          bestMethod: 'market',
          bestProfit: 10,
          bestProfitPerHour: 3600,
        },
        {
          name: 'Iron Ore',
          timeSeconds: 20,
          cost: 10,
          vendorValue: 25,
          marketPrice: 20,
          vendorProfit: 15,
          vendorProfitPerHour: 2700,
          marketProfit: 10,
          marketProfitPerHour: 1800,
          bestMethod: 'vendor',
          bestProfit: 15,
          bestProfitPerHour: 2700,
        },
      ]

      const ranked = rankAllActivities([], [], resourceResults)

      expect(ranked).toHaveLength(2)

      // Oak Log should be first (higher profit)
      expect(ranked[0].name).toBe('Oak Log')
      expect(ranked[0].saleMethod).toBe('market')

      // Iron Ore should be second
      expect(ranked[1].name).toBe('Iron Ore')
      expect(ranked[1].saleMethod).toBe('vendor')
    })

    it('should not include saleMethod for dungeon activities', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Test Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 500,
          totalProfit: 400,
          profitPerHour: 8000,
          drops: [],
        },
      ]

      const ranked = rankAllActivities(dungeonResults, [], [])

      expect(ranked).toHaveLength(1)
      expect(ranked[0].name).toBe('Test Dungeon')
      expect(ranked[0].saleMethod).toBeUndefined()
    })

    it('should not include saleMethod for craftable activities', () => {
      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Iron Sword',
          craftTimeSeconds: 60,
          marketPrice: 200,
          totalCost: 100,
          profit: 100,
          profitPerHour: 6000,
          materials: [],
          isCraftable: true,
        },
      ]

      const ranked = rankAllActivities([], craftableResults, [])

      expect(ranked).toHaveLength(1)
      expect(ranked[0].name).toBe('Iron Sword')
      expect(ranked[0].saleMethod).toBeUndefined()
    })

    it('should correctly rank mixed activities with saleMethod', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Low Profit Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 200,
          totalProfit: 100,
          profitPerHour: 2000,
          drops: [],
        },
      ]

      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'High Profit Resource',
          timeSeconds: 10,
          cost: 5,
          vendorValue: 15,
          marketPrice: 10,
          vendorProfit: 10,
          vendorProfitPerHour: 3600,
          marketProfit: 5,
          marketProfitPerHour: 1800,
          bestMethod: 'vendor',
          bestProfit: 10,
          bestProfitPerHour: 3600,
        },
      ]

      const ranked = rankAllActivities(dungeonResults, [], resourceResults)

      expect(ranked).toHaveLength(2)

      // Resource should be first (higher profit)
      expect(ranked[0].name).toBe('High Profit Resource')
      expect(ranked[0].saleMethod).toBe('vendor')
      expect(ranked[0].isRecommended).toBe(true)

      // Dungeon should be second
      expect(ranked[1].name).toBe('Low Profit Dungeon')
      expect(ranked[1].saleMethod).toBeUndefined()
      expect(ranked[1].isRecommended).toBe(false)
    })
  })

  describe('getBestAction', () => {
    it('should return activity with saleMethod if it is a resource', () => {
      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'Oak Log',
          timeSeconds: 10,
          cost: 5,
          vendorValue: 10,
          marketPrice: 15,
          vendorProfit: 5,
          vendorProfitPerHour: 1800,
          marketProfit: 10,
          marketProfitPerHour: 3600,
          bestMethod: 'market',
          bestProfit: 10,
          bestProfitPerHour: 3600,
        },
      ]

      const ranked = rankAllActivities([], [], resourceResults)
      const best = getBestAction(ranked)

      expect(best).not.toBeNull()
      expect(best?.name).toBe('Oak Log')
      expect(best?.saleMethod).toBe('market')
    })

    it('should return null for empty activities', () => {
      const best = getBestAction([])
      expect(best).toBeNull()
    })
  })
})
