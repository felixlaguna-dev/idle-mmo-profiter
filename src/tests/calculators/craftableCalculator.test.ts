/**
 * Tests for craftable profit calculator
 * These tests verify that recipe costs are only applied when appropriate
 *
 * Dual profitability is shown when:
 * 1. A tradable recipe exists for the craftable, AND
 * 2. The recipe has limited uses (uses > 0)
 * This lets the user compare: profit with vs without recipe cost
 */

import { describe, it, expect } from 'vitest'
import { calculateCraftableProfits } from '../../calculators/craftableCalculator'
import type { CraftableRecipe, Recipe } from '../../types'

describe('calculateCraftableProfits', () => {
  const mockTaxRate = 0.12

  const mockCraftableRecipe: CraftableRecipe = {
    name: 'Wraithbane',
    timeSeconds: 1090.9,
    materials: [
      { name: 'Moose antler', quantity: 15 },
      { name: 'Minotaur Hide', quantity: 20 },
    ],
    currentPrice: 11894.6,
  }

  const mockMaterialPriceMap = new Map<string, number>([
    ['Moose antler', 114.1],
    ['Minotaur Hide', 378.9],
  ])

  describe('recipe cost logic', () => {
    it('should apply recipe cost when craftable has both tradable AND untradable recipes', () => {
      // Wraithbane has both a tradable and untradable recipe
      // Show dual profitability so user can compare free vs bought recipe
      const recipes: Recipe[] = [
        {
          id: 'rec-161',
          name: 'Wraithbane Essence Recipe',
          price: 1213888.8,
          chance: 0.0042,
          uses: 10,
          producesItemName: 'Wraithbane',
          isUntradable: false,
        },
        {
          id: 'rec-163',
          name: 'Wraithbane Essence Recipe (Untradable)',
          price: 0,
          chance: 0.0133,
          uses: 10,
          producesItemName: 'Wraithbane',
          isUntradable: true,
        },
      ]

      const results = calculateCraftableProfits(
        [mockCraftableRecipe],
        mockTaxRate,
        mockMaterialPriceMap,
        recipes
      )

      expect(results).toHaveLength(1)
      const result = results[0]

      // Dual profitability: main profit = with recipe cost, tooltip shows without
      expect(result.hasRecipeCost).toBe(true)
      expect(result.profitWithRecipeCost).toBeDefined()
      expect(result.profitPerHourWithRecipeCost).toBeDefined()
      expect(result.recipeCostPerCraft).toBe(1213888.8 / 10)
    })

    it('should apply recipe cost when craftable has tradable recipe with uses > 0 (even without untradable alternative)', () => {
      // Any craftable with a tradable recipe with limited uses shows dual profitability
      const craftableRecipe: CraftableRecipe = {
        name: 'Exclusive Elixir',
        timeSeconds: 1000,
        materials: [{ name: 'Rare Herb', quantity: 10 }],
        currentPrice: 5000,
      }

      const materialPriceMap = new Map<string, number>([['Rare Herb', 100]])

      const recipes: Recipe[] = [
        {
          id: 'rec-999',
          name: 'Exclusive Elixir Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Exclusive Elixir',
          isUntradable: false,
        },
        // Note: NO untradable version exists
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      const result = results[0]

      expect(result.hasRecipeCost).toBe(true)
      expect(result.profitWithRecipeCost).toBeDefined()
      expect(result.profitPerHourWithRecipeCost).toBeDefined()
      expect(result.recipeCostPerCraft).toBe(10000 / 10)
    })

    it('should NOT apply recipe cost when tradable recipe has uses = 0', () => {
      // uses=0 means unlimited/untracked uses, no dual profitability needed
      const craftableRecipe: CraftableRecipe = {
        name: 'Unlimited Craftable',
        timeSeconds: 1000,
        materials: [{ name: 'Common Herb', quantity: 5 }],
        currentPrice: 3000,
      }

      const materialPriceMap = new Map<string, number>([['Common Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-998',
          name: 'Unlimited Craftable Recipe',
          price: 5000,
          chance: 0.05,
          uses: 0, // Unlimited uses
          producesItemName: 'Unlimited Craftable',
          isUntradable: false,
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      const result = results[0]

      expect(result.hasRecipeCost).toBe(false)
      expect(result.profitWithRecipeCost).toBeUndefined()
      expect(result.profitPerHourWithRecipeCost).toBeUndefined()
    })

    it('should NOT apply recipe cost when craftable has no recipes at all', () => {
      const results = calculateCraftableProfits(
        [mockCraftableRecipe],
        mockTaxRate,
        mockMaterialPriceMap,
        []
      )

      expect(results).toHaveLength(1)
      const result = results[0]

      expect(result.hasRecipeCost).toBe(false)
      expect(result.profitWithRecipeCost).toBeUndefined()
    })

    it('should NOT apply recipe cost when craftable has ONLY untradable recipe', () => {
      const recipes: Recipe[] = [
        {
          id: 'rec-163',
          name: 'Wraithbane Essence Recipe (Untradable)',
          price: 0,
          chance: 0.0133,
          uses: 10,
          producesItemName: 'Wraithbane',
          isUntradable: true,
        },
      ]

      const results = calculateCraftableProfits(
        [mockCraftableRecipe],
        mockTaxRate,
        mockMaterialPriceMap,
        recipes
      )

      expect(results).toHaveLength(1)
      const result = results[0]

      expect(result.hasRecipeCost).toBe(false)
      expect(result.profitWithRecipeCost).toBeUndefined()
    })
  })

  describe('basic profitability calculations', () => {
    it('should calculate profit correctly without recipe cost', () => {
      const results = calculateCraftableProfits(
        [mockCraftableRecipe],
        mockTaxRate,
        mockMaterialPriceMap,
        []
      )

      expect(results).toHaveLength(1)
      const result = results[0]

      // Material cost: (15 * 114.1) + (20 * 378.9) = 1711.5 + 7578 = 9289.5
      const expectedTotalCost = 9289.5
      expect(result.totalCost).toBeCloseTo(expectedTotalCost, 2)

      // Min sell price: 9289.5 / (1 - 0.12) = 9289.5 / 0.88 = 10556.25
      const expectedMinSellPrice = expectedTotalCost / (1 - mockTaxRate)
      expect(result.minSellPrice).toBeCloseTo(expectedMinSellPrice, 2)

      // Profit: (11894.6 * 0.88) - 9289.5 = 10467.248 - 9289.5 = 1177.748
      const sellAfterTax = mockCraftableRecipe.currentPrice * (1 - mockTaxRate)
      const expectedProfit = sellAfterTax - expectedTotalCost
      expect(result.profit).toBeCloseTo(expectedProfit, 2)

      // Profit per hour
      const expectedProfitPerHour = expectedProfit / (mockCraftableRecipe.timeSeconds / 3600)
      expect(result.profitPerHour).toBeCloseTo(expectedProfitPerHour, 2)
    })
  })

  describe('skill inference', () => {
    it('should pass through skill from CraftableRecipe when present', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'Alchemy Craftable',
        timeSeconds: 1000,
        materials: [{ name: 'Rare Herb', quantity: 10 }],
        currentPrice: 5000,
        skill: 'alchemy',
      }

      const materialPriceMap = new Map<string, number>([['Rare Herb', 100]])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].skill).toBe('alchemy')
    })

    it('should infer alchemy from Vial material name', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'Mystery Craftable',
        timeSeconds: 1000,
        materials: [
          { name: 'Gleaming Vial', quantity: 1 },
          { name: 'Rare Herb', quantity: 10 },
        ],
        currentPrice: 5000,
      }

      const materialPriceMap = new Map<string, number>([
        ['Gleaming Vial', 100],
        ['Rare Herb', 50],
      ])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].skill).toBe('alchemy')
    })

    it('should infer alchemy from Crystal material name', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'Crystal Craftable',
        timeSeconds: 1000,
        materials: [
          { name: 'Elemental Crystal', quantity: 1 },
          { name: 'Metal Bar', quantity: 5 },
        ],
        currentPrice: 8000,
      }

      const materialPriceMap = new Map<string, number>([
        ['Elemental Crystal', 200],
        ['Metal Bar', 100],
      ])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].skill).toBe('alchemy')
    })

    it('should default to forging when no Vial or Crystal in materials', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'Forged Item',
        timeSeconds: 1000,
        materials: [
          { name: 'Moose antler', quantity: 15 },
          { name: 'Minotaur Hide', quantity: 20 },
        ],
        currentPrice: 10000,
      }

      const materialPriceMap = new Map<string, number>([
        ['Moose antler', 100],
        ['Minotaur Hide', 200],
      ])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].skill).toBe('forging')
    })

    it('should prefer explicit skill over inferred skill', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'Edge Case Potion',
        timeSeconds: 1000,
        materials: [
          { name: 'Gleaming Vial', quantity: 1 },
          { name: 'Rare Material', quantity: 5 },
        ],
        currentPrice: 5000,
        skill: 'forging', // Explicit skill differs from what would be inferred
      }

      const materialPriceMap = new Map<string, number>([
        ['Gleaming Vial', 100],
        ['Rare Material', 50],
      ])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].skill).toBe('forging') // Should use explicit skill, not inferred 'alchemy'
    })
  })

  describe('low-confidence detection', () => {
    it('should mark craftable as low-confidence when no lastSaleAt provided', () => {
      const craftableRecipe: CraftableRecipe = {
        name: 'No Sales Data Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        // No lastSaleAt field
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].isLowConfidence).toBe(true)
    })

    it('should mark craftable as low-confidence when last sale was over 30 days ago', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45) // 45 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Stale Sales Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: oldDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].isLowConfidence).toBe(true)
    })

    it('should NOT mark craftable as low-confidence when last sale was recent (no tradable recipe)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Recent Sales Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      expect(results[0].isLowConfidence).toBe(false)
    })

    it('should NOT mark craftable as low-confidence at exactly 30 days boundary', () => {
      const boundaryDate = new Date()
      boundaryDate.setDate(boundaryDate.getDate() - 30) // Exactly 30 days

      const craftableRecipe: CraftableRecipe = {
        name: 'Boundary Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: boundaryDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, [])

      expect(results).toHaveLength(1)
      // Exactly 30 days is NOT low confidence (threshold is > 30)
      expect(results[0].isLowConfidence).toBe(false)
    })
  })

  describe('low-confidence detection with tradable recipes', () => {
    // IMPORTANT: isLowConfidence checks the ENTIRE crafting chain:
    // - craftable itself, tradable recipe (if any), and materials (if map provided)
    // isRecipeLowConfidence is tracked separately for UI display on recipe cost line

    it('should be low-confidence when recipe has stale sales (even if craftable is recent)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45) // 45 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Recent Sales Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable has recent sales
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-stale',
          name: 'Stale Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Recent Sales Item',
          isUntradable: false,
          lastSaleAt: oldDate.toISOString(), // Recipe has NO recent sales
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Recipe is stale = entire chain is low confidence
      expect(results[0].isLowConfidence).toBe(true)
      // The recipe itself is also low-confidence
      expect(results[0].isRecipeLowConfidence).toBe(true)
    })

    it('should be low-confidence when craftable has NO recent sales (regardless of recipe)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45) // 45 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Stale Sales Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: oldDate.toISOString(), // Craftable has NO recent sales
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-recent',
          name: 'Recent Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Stale Sales Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(), // Recipe has recent sales
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Craftable has stale sales = low confidence
      expect(results[0].isLowConfidence).toBe(true)
      // Recipe has recent sales
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should mark both as low-confidence when BOTH craftable AND recipe have stale sales', () => {
      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45) // 45 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Both Stale Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: oldDate.toISOString(), // Craftable has NO recent sales
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-both-stale',
          name: 'Both Stale Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Both Stale Item',
          isUntradable: false,
          lastSaleAt: oldDate.toISOString(), // Recipe also has NO recent sales
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Both are low confidence
      expect(results[0].isLowConfidence).toBe(true)
      expect(results[0].isRecipeLowConfidence).toBe(true)
    })

    it('should have isRecipeLowConfidence=false when no tradable recipe exists', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'No Tradable Recipe Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      // No recipes array provided
      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, undefined)

      expect(results).toHaveLength(1)
      // No tradable recipe = craftable's lastSaleAt matters, isRecipeLowConfidence is false
      expect(results[0].isLowConfidence).toBe(false)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should have isRecipeLowConfidence=true when recipe has NO lastSaleAt', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Craftable Recent Recipe No Data',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable has recent sales
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-no-data',
          name: 'No Data Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Craftable Recent Recipe No Data',
          isUntradable: false,
          // No lastSaleAt field
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Craftable has recent sales = high confidence
      expect(results[0].isLowConfidence).toBe(false)
      // Recipe has no sales data = isRecipeLowConfidence = true
      expect(results[0].isRecipeLowConfidence).toBe(true)
    })

    it('should have isRecipeLowConfidence=false when recipe is untradable', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Untradable Recipe Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable has recent sales
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-untradable',
          name: 'Untradable Recipe',
          price: 0,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Untradable Recipe Item',
          isUntradable: true,
          lastSaleAt: undefined, // Untradable recipes don't have lastSaleAt
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Craftable has recent sales = high confidence
      expect(results[0].isLowConfidence).toBe(false)
      // Untradable recipe = isRecipeLowConfidence is false (no tradable recipe)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should have both flags high-confidence when BOTH craftable AND recipe have recent sales', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Dual Recent Sales Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const recipes: Recipe[] = [
        {
          id: 'rec-dual',
          name: 'Dual Recent Sales Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Dual Recent Sales Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(), // Recipe also has recent sales
        },
      ]

      const results = calculateCraftableProfits([craftableRecipe], mockTaxRate, materialPriceMap, recipes)

      expect(results).toHaveLength(1)
      // Both have recent sales = both high confidence
      expect(results[0].isLowConfidence).toBe(false)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })
  })

  describe('low-confidence detection for entire crafting chain', () => {
    // IMPORTANT: isLowConfidence checks the ENTIRE crafting chain:
    // - craftable itself
    // - tradable recipe (if any)
    // - ALL materials

    it('should NOT mark craftable as low-confidence when vendor-sold materials lack sales data', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Vendor Material Craftable',
        timeSeconds: 1000,
        materials: [
          { name: 'Cheap Vial', quantity: 1 }, // Vendor-sold (has vendorValue)
          { name: 'Rare Herb', quantity: 5 }, // Market-only
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([
        ['Cheap Vial', 10],
        ['Rare Herb', 50],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        // Cheap Vial has NO lastSaleAt entry (vendor-sold)
        ['Rare Herb', recentDate.toISOString()], // Market item has recent sales
      ])

      const materialVendorValueMap = new Map<string, number>([
        ['Cheap Vial', 10], // Vendor-sold material (vendorValue > 0)
        // Rare Herb has no vendor value (market-only)
      ])

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        [],
        materialLastSaleAtMap,
        materialVendorValueMap
      )

      expect(results).toHaveLength(1)
      // Vendor-sold materials are excluded from low-confidence check
      expect(results[0].isLowConfidence).toBe(false)
    })

    it('should mark craftable as low-confidence when market-only materials lack sales data even if vendor materials are fine', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45)

      const craftableRecipe: CraftableRecipe = {
        name: 'Market Material Missing',
        timeSeconds: 1000,
        materials: [
          { name: 'Cheap Vial', quantity: 1 }, // Vendor-sold
          { name: 'Rare Herb', quantity: 5 }, // Market-only, but STALE
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([
        ['Cheap Vial', 10],
        ['Rare Herb', 50],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        // Cheap Vial has NO entry (vendor-sold, ignored)
        ['Rare Herb', oldDate.toISOString()], // Market material is STALE
      ])

      const materialVendorValueMap = new Map<string, number>([
        ['Cheap Vial', 10], // Vendor-sold
        // Rare Herb has no vendor value
      ])

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        [],
        materialLastSaleAtMap,
        materialVendorValueMap
      )

      expect(results).toHaveLength(1)
      // Market-only material is stale = low confidence
      expect(results[0].isLowConfidence).toBe(true)
    })

    it('should work without materialVendorValueMap parameter (backwards compatibility)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const craftableRecipe: CraftableRecipe = {
        name: 'Backwards Compat Vendor Check',
        timeSeconds: 1000,
        materials: [
          { name: 'Cheap Vial', quantity: 1 },
          { name: 'Rare Herb', quantity: 5 },
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([
        ['Cheap Vial', 10],
        ['Rare Herb', 50],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Cheap Vial', recentDate.toISOString()],
        ['Rare Herb', recentDate.toISOString()],
      ])

      // Call WITHOUT materialVendorValueMap parameter (it's optional)
      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        [],
        materialLastSaleAtMap
        // No materialVendorValueMap parameter
      )

      expect(results).toHaveLength(1)
      // All materials have recent sales = high confidence
      expect(results[0].isLowConfidence).toBe(false)
    })

    it('should be high-confidence when craftable, recipe, AND all materials have recent sales', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5) // 5 days ago

      const craftableRecipe: CraftableRecipe = {
        name: 'Chain High Confidence Item',
        timeSeconds: 1000,
        materials: [
          { name: 'Herb', quantity: 5 },
          { name: 'Crystal', quantity: 2 },
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([
        ['Herb', 50],
        ['Crystal', 100],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Herb', recentDate.toISOString()],
        ['Crystal', recentDate.toISOString()],
      ])

      const recipes: Recipe[] = [
        {
          id: 'rec-chain',
          name: 'Chain Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Chain High Confidence Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(),
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // All have recent sales = high confidence
      expect(results[0].isLowConfidence).toBe(false)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should be low-confidence when craftable has NO recent sales (even if recipe and materials are recent)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45)

      const craftableRecipe: CraftableRecipe = {
        name: 'Stale Craftable Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: oldDate.toISOString(), // Craftable is STALE
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Herb', recentDate.toISOString()], // Material is recent
      ])

      const recipes: Recipe[] = [
        {
          id: 'rec-recent',
          name: 'Recent Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Stale Craftable Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(), // Recipe is recent
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // Craftable is stale = low confidence
      expect(results[0].isLowConfidence).toBe(true)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should be low-confidence when tradable recipe has NO recent sales (even if craftable and materials are recent)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45)

      const craftableRecipe: CraftableRecipe = {
        name: 'Stale Recipe Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable is recent
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Herb', recentDate.toISOString()], // Material is recent
      ])

      const recipes: Recipe[] = [
        {
          id: 'rec-stale',
          name: 'Stale Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Stale Recipe Item',
          isUntradable: false,
          lastSaleAt: oldDate.toISOString(), // Recipe is STALE
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // Recipe is stale = low confidence for the whole chain
      expect(results[0].isLowConfidence).toBe(true)
      expect(results[0].isRecipeLowConfidence).toBe(true)
    })

    it('should be low-confidence when ONE material has NO recent sales (even if craftable and recipe are recent)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45)

      const craftableRecipe: CraftableRecipe = {
        name: 'Stale Material Item',
        timeSeconds: 1000,
        materials: [
          { name: 'Herb', quantity: 5 },
          { name: 'Crystal', quantity: 2 },
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable is recent
      }

      const materialPriceMap = new Map<string, number>([
        ['Herb', 50],
        ['Crystal', 100],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Herb', recentDate.toISOString()], // Herb is recent
        ['Crystal', oldDate.toISOString()], // Crystal is STALE
      ])

      const recipes: Recipe[] = [
        {
          id: 'rec-recent',
          name: 'Recent Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Stale Material Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(), // Recipe is recent
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // One material is stale = low confidence
      expect(results[0].isLowConfidence).toBe(true)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should be low-confidence when MULTIPLE materials have NO recent sales', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const oldDate = new Date()
      oldDate.setDate(oldDate.getDate() - 45)

      const craftableRecipe: CraftableRecipe = {
        name: 'Multiple Stale Materials Item',
        timeSeconds: 1000,
        materials: [
          { name: 'Herb', quantity: 5 },
          { name: 'Crystal', quantity: 2 },
          { name: 'Essence', quantity: 1 },
        ],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable is recent
      }

      const materialPriceMap = new Map<string, number>([
        ['Herb', 50],
        ['Crystal', 100],
        ['Essence', 200],
      ])

      const materialLastSaleAtMap = new Map<string, string>([
        ['Herb', oldDate.toISOString()], // Herb is STALE
        ['Crystal', oldDate.toISOString()], // Crystal is STALE
        // Essence has no entry (also counts as stale)
      ])

      const recipes: Recipe[] = [
        {
          id: 'rec-recent',
          name: 'Recent Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Multiple Stale Materials Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(), // Recipe is recent
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // Multiple materials are stale = low confidence
      expect(results[0].isLowConfidence).toBe(true)
      expect(results[0].isRecipeLowConfidence).toBe(false)
    })

    it('should be low-confidence when material has NO lastSaleAt entry in map', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const craftableRecipe: CraftableRecipe = {
        name: 'Missing Material Data Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(), // Craftable is recent
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      // Empty map - material has no lastSaleAt data
      const materialLastSaleAtMap = new Map<string, string>()

      const recipes: Recipe[] = [
        {
          id: 'rec-recent',
          name: 'Recent Recipe',
          price: 10000,
          chance: 0.01,
          uses: 10,
          producesItemName: 'Missing Material Data Item',
          isUntradable: false,
          lastSaleAt: recentDate.toISOString(),
        },
      ]

      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        recipes,
        materialLastSaleAtMap
      )

      expect(results).toHaveLength(1)
      // Material has no data = low confidence
      expect(results[0].isLowConfidence).toBe(true)
    })

    it('should work without materialLastSaleAtMap parameter (backwards compatibility)', () => {
      const recentDate = new Date()
      recentDate.setDate(recentDate.getDate() - 5)

      const craftableRecipe: CraftableRecipe = {
        name: 'Backwards Compat Item',
        timeSeconds: 1000,
        materials: [{ name: 'Herb', quantity: 5 }],
        currentPrice: 3000,
        lastSaleAt: recentDate.toISOString(),
      }

      const materialPriceMap = new Map<string, number>([['Herb', 50]])

      // Call without materialLastSaleAtMap parameter
      const results = calculateCraftableProfits(
        [craftableRecipe],
        mockTaxRate,
        materialPriceMap,
        []
        // No materialLastSaleAtMap parameter
      )

      expect(results).toHaveLength(1)
      // Craftable has recent sales, no materials data to check = high confidence
      expect(results[0].isLowConfidence).toBe(false)
    })
  })
})
