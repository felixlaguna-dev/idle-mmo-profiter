/**
 * Regression test for Iron Fitting cross-recipe material price resolution bug.
 *
 * Bug: Iron Fitting (construction recipe) uses Iron Bar (a smelting recipe output)
 * as a material. rawResourcePriceMap only seeds prices from resourceGathering[],
 * so Iron Bar's price resolved to 0, causing Iron Fitting's buy-all cost to be
 * underreported.
 *
 * Fix: rawResourcePriceMap should also seed prices from resourceRecipes[] outputs,
 * so that any recipe output used as a cross-recipe material resolves correctly.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useDataProvider } from '../../composables/useDataProvider'
import defaultData from '../../data/defaults.json'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    clear: () => {
      store = {}
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    key: (index: number) => {
      const keys = Object.keys(store)
      return keys[index] || null
    },
    get length() {
      return Object.keys(store).length
    },
  }
})()

global.localStorage = localStorageMock as Storage

describe('Iron Fitting cross-recipe material price resolution', () => {
  beforeEach(() => {
    localStorage.clear()
    const dataProvider = useDataProvider()
    dataProvider.clearAllOverrides()
  })

  it('Iron Bar should have a non-zero currentPrice in resourceRecipes', () => {
    // Prerequisite: Iron Bar must exist in resourceRecipes with a real market price
    const ironBarRecipe = (defaultData as typeof defaultData).resourceRecipes?.find(
      (r) => r.name === 'Iron Bar',
    )
    expect(ironBarRecipe).toBeDefined()
    expect(ironBarRecipe!.currentPrice).toBeGreaterThan(0)
  })

  it('Iron Fitting recipe should exist in resourceRecipes and use Iron Bar as material', () => {
    const ironFittingRecipe = (defaultData as typeof defaultData).resourceRecipes?.find(
      (r) => r.name === 'Iron Fitting',
    )
    expect(ironFittingRecipe).toBeDefined()
    const ironBarMaterial = ironFittingRecipe!.materials.find((m) => m.name === 'Iron Bar')
    expect(ironBarMaterial).toBeDefined()
    expect(ironBarMaterial!.quantity).toBe(3)
  })

  it('Iron Fitting buy-all baseCost should be non-zero (Iron Bar price must resolve)', () => {
    const dataProvider = useDataProvider()

    // Find the auto-generated "buy all" entry for Iron Fitting in resourceGathering
    const ironFittingBuyAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting',
    )

    expect(ironFittingBuyAll).toBeDefined()

    // Iron Bar currentPrice is 28g, quantity 3 => material cost = 84g
    // Without the fix, rawResourcePriceMap doesn't include Iron Bar, so baseCost = 0
    expect(ironFittingBuyAll!.baseCost).toBeGreaterThan(0)
  })

  it('Iron Fitting buy-all baseCost should equal Iron Bar market price * quantity', () => {
    const dataProvider = useDataProvider()

    // Get Iron Bar's current price from resourceRecipes
    const ironBarRecipe = (defaultData as typeof defaultData).resourceRecipes?.find(
      (r) => r.name === 'Iron Bar',
    )
    const ironFittingRecipe = (defaultData as typeof defaultData).resourceRecipes?.find(
      (r) => r.name === 'Iron Fitting',
    )
    const ironBarMaterial = ironFittingRecipe!.materials.find((m) => m.name === 'Iron Bar')!

    const expectedCost = ironBarRecipe!.currentPrice * ironBarMaterial.quantity

    // Find the auto-generated "buy all" entry for Iron Fitting
    const ironFittingBuyAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting',
    )

    expect(ironFittingBuyAll).toBeDefined()
    expect(ironFittingBuyAll!.baseCost).toBeCloseTo(expectedCost, 2)
  })

  it('rawResourcePriceMap should resolve Iron Bar price from resourceRecipes output', () => {
    const dataProvider = useDataProvider()

    // The exported resourceGathering should reflect correct material pricing.
    // If rawResourcePriceMap seeds from resourceRecipes, Iron Bar entry will exist
    // and Iron Fitting's buy-all entry will have the correct cost.
    const ironFittingBuyAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting',
    )
    const ironFittingGather = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    const ironFittingGatherAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather all)',
    )

    expect(ironFittingBuyAll).toBeDefined()
    expect(ironFittingGather).toBeDefined()
    expect(ironFittingGatherAll).toBeDefined()

    // All three modes should have non-zero baseCost since Iron Bar has a market price
    // and no "gather" version of Iron Bar exists (it's a smelting recipe, not raw ore)
    // In gather/gather-all modes, Iron Bar isn't in resourceGathering so gatherTime=0
    // but baseCost (buy cost) is still used for non-gathereable materials
    // Buy-all mode: baseCost must be non-zero
    expect(ironFittingBuyAll!.baseCost).toBeGreaterThan(0)
  })
})
