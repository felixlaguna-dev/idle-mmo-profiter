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

  describe('isLowConfidence', () => {
    it('should pass through isLowConfidence for dungeon activities', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Low Confidence Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 500,
          totalProfit: 400,
          profitPerHour: 8000,
          drops: [],
          isLowConfidence: true,
        },
        {
          name: 'High Confidence Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 400,
          totalProfit: 300,
          profitPerHour: 6000,
          drops: [],
          isLowConfidence: false,
        },
      ]

      const ranked = rankAllActivities(dungeonResults, [], [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('Low Confidence Dungeon')
      expect(ranked[0].isLowConfidence).toBe(true)
      expect(ranked[1].name).toBe('High Confidence Dungeon')
      expect(ranked[1].isLowConfidence).toBe(false)
    })

    it('should pass through isLowConfidence for craftable activities', () => {
      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Low Confidence Craftable',
          craftTimeSeconds: 60,
          marketPrice: 200,
          totalCost: 100,
          profit: 100,
          profitPerHour: 6000,
          materials: [],
          isLowConfidence: true,
        },
        {
          name: 'High Confidence Craftable',
          craftTimeSeconds: 60,
          marketPrice: 180,
          totalCost: 100,
          profit: 80,
          profitPerHour: 4800,
          materials: [],
          isLowConfidence: false,
        },
      ]

      const ranked = rankAllActivities([], craftableResults, [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('Low Confidence Craftable')
      expect(ranked[0].isLowConfidence).toBe(true)
      expect(ranked[1].name).toBe('High Confidence Craftable')
      expect(ranked[1].isLowConfidence).toBe(false)
    })

    it('should have undefined isLowConfidence for resource activities', () => {
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

      expect(ranked).toHaveLength(1)
      expect(ranked[0].name).toBe('Oak Log')
      expect(ranked[0].isLowConfidence).toBeUndefined()
    })

    it('should preserve isLowConfidence when mixing activity types', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Low Confidence Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 1000,
          totalProfit: 900,
          profitPerHour: 18000,
          drops: [],
          isLowConfidence: true,
        },
      ]

      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'High Confidence Craftable',
          craftTimeSeconds: 60,
          marketPrice: 500,
          totalCost: 100,
          profit: 400,
          profitPerHour: 24000,
          materials: [],
          isLowConfidence: false,
        },
      ]

      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'Resource',
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

      const ranked = rankAllActivities(dungeonResults, craftableResults, resourceResults)

      expect(ranked).toHaveLength(3)
      // Sorted by profit per hour: craftable > dungeon > resource
      expect(ranked[0].name).toBe('High Confidence Craftable')
      expect(ranked[0].isLowConfidence).toBe(false)

      expect(ranked[1].name).toBe('Low Confidence Dungeon')
      expect(ranked[1].isLowConfidence).toBe(true)

      expect(ranked[2].name).toBe('Resource')
      expect(ranked[2].isLowConfidence).toBeUndefined()
    })
  })

  describe('skill field propagation', () => {
    it('should propagate skill field from craftable activities', () => {
      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Health Potion',
          craftTimeSeconds: 60,
          marketPrice: 200,
          totalCost: 100,
          profit: 100,
          profitPerHour: 6000,
          materials: [],
          skill: 'alchemy',
        },
        {
          name: 'Iron Sword',
          craftTimeSeconds: 90,
          marketPrice: 300,
          totalCost: 150,
          profit: 150,
          profitPerHour: 6000,
          materials: [],
          skill: 'forging',
        },
      ]

      const ranked = rankAllActivities([], craftableResults, [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('Health Potion')
      expect(ranked[0].skill).toBe('alchemy')
      expect(ranked[1].name).toBe('Iron Sword')
      expect(ranked[1].skill).toBe('forging')
    })

    it('should have undefined skill for dungeon activities', () => {
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
      expect(ranked[0].skill).toBeUndefined()
    })

    it('should have undefined skill for resource activities', () => {
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

      expect(ranked).toHaveLength(1)
      expect(ranked[0].name).toBe('Oak Log')
      expect(ranked[0].skill).toBeUndefined()
    })

    it('should preserve skill when mixing activity types', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 1000,
          totalProfit: 900,
          profitPerHour: 18000,
          drops: [],
        },
      ]

      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Alchemy Item',
          craftTimeSeconds: 60,
          marketPrice: 500,
          totalCost: 100,
          profit: 400,
          profitPerHour: 24000,
          materials: [],
          skill: 'alchemy',
        },
        {
          name: 'Forging Item',
          craftTimeSeconds: 60,
          marketPrice: 400,
          totalCost: 100,
          profit: 300,
          profitPerHour: 18000,
          materials: [],
          skill: 'forging',
        },
      ]

      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'Resource',
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

      const ranked = rankAllActivities(dungeonResults, craftableResults, resourceResults)

      expect(ranked).toHaveLength(4)

      // Sorted by profit per hour: alchemy > dungeon/forging > resource
      expect(ranked[0].name).toBe('Alchemy Item')
      expect(ranked[0].skill).toBe('alchemy')

      // Dungeon and Forging Item both have 18000 profit/hour, order may vary
      const dungeonRank = ranked.find((a) => a.name === 'Dungeon')
      const forgingRank = ranked.find((a) => a.name === 'Forging Item')
      expect(dungeonRank?.skill).toBeUndefined()
      expect(forgingRank?.skill).toBe('forging')

      expect(ranked[3].name).toBe('Resource')
      expect(ranked[3].skill).toBeUndefined()
    })
  })

  describe('weeklySalesVolume field propagation', () => {
    it('should propagate minDropVolume from dungeon activities', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'High Volume Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 500,
          totalProfit: 400,
          profitPerHour: 8000,
          drops: [],
          minDropVolume: 50,
        },
        {
          name: 'Low Volume Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 400,
          totalProfit: 300,
          profitPerHour: 6000,
          drops: [],
          minDropVolume: 5,
        },
      ]

      const ranked = rankAllActivities(dungeonResults, [], [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('High Volume Dungeon')
      expect(ranked[0].weeklySalesVolume).toBe(50)
      expect(ranked[1].name).toBe('Low Volume Dungeon')
      expect(ranked[1].weeklySalesVolume).toBe(5)
    })

    it('should propagate weeklySalesVolume from craftable activities', () => {
      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Popular Craftable',
          craftTimeSeconds: 60,
          marketPrice: 200,
          totalCost: 100,
          profit: 100,
          profitPerHour: 6000,
          materials: [],
          weeklySalesVolume: 100,
        },
        {
          name: 'Niche Craftable',
          craftTimeSeconds: 60,
          marketPrice: 180,
          totalCost: 100,
          profit: 80,
          profitPerHour: 4800,
          materials: [],
          weeklySalesVolume: 3,
        },
      ]

      const ranked = rankAllActivities([], craftableResults, [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('Popular Craftable')
      expect(ranked[0].weeklySalesVolume).toBe(100)
      expect(ranked[1].name).toBe('Niche Craftable')
      expect(ranked[1].weeklySalesVolume).toBe(3)
    })

    it('should have undefined weeklySalesVolume for resource activities', () => {
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

      expect(ranked).toHaveLength(1)
      expect(ranked[0].name).toBe('Oak Log')
      expect(ranked[0].weeklySalesVolume).toBeUndefined()
    })

    it('should handle undefined weeklySalesVolume for dungeons without volume data', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Dungeon With Volume',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 500,
          totalProfit: 400,
          profitPerHour: 8000,
          drops: [],
          minDropVolume: 25,
        },
        {
          name: 'Dungeon Without Volume',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 400,
          totalProfit: 300,
          profitPerHour: 6000,
          drops: [],
          // minDropVolume is undefined
        },
      ]

      const ranked = rankAllActivities(dungeonResults, [], [])

      expect(ranked).toHaveLength(2)
      expect(ranked[0].name).toBe('Dungeon With Volume')
      expect(ranked[0].weeklySalesVolume).toBe(25)
      expect(ranked[1].name).toBe('Dungeon Without Volume')
      expect(ranked[1].weeklySalesVolume).toBeUndefined()
    })

    it('should preserve weeklySalesVolume when mixing activity types', () => {
      const dungeonResults: DungeonProfitResult[] = [
        {
          name: 'Dungeon',
          timeSeconds: 180,
          runCost: 100,
          totalRevenue: 1000,
          totalProfit: 900,
          profitPerHour: 18000,
          drops: [],
          minDropVolume: 15,
        },
      ]

      const craftableResults: CraftableProfitResult[] = [
        {
          name: 'Craftable',
          craftTimeSeconds: 60,
          marketPrice: 500,
          totalCost: 100,
          profit: 400,
          profitPerHour: 24000,
          materials: [],
          weeklySalesVolume: 75,
        },
      ]

      const resourceResults: ResourceProfitResult[] = [
        {
          name: 'Resource',
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

      const ranked = rankAllActivities(dungeonResults, craftableResults, resourceResults)

      expect(ranked).toHaveLength(3)
      // Sorted by profit per hour: craftable > dungeon > resource
      expect(ranked[0].name).toBe('Craftable')
      expect(ranked[0].weeklySalesVolume).toBe(75)

      expect(ranked[1].name).toBe('Dungeon')
      expect(ranked[1].weeklySalesVolume).toBe(15)

      expect(ranked[2].name).toBe('Resource')
      expect(ranked[2].weeklySalesVolume).toBeUndefined()
    })
  })
})
