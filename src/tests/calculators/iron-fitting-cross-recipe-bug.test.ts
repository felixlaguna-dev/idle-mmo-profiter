/**
 * Regression tests for Iron Fitting multi-level recipe dependency resolution.
 *
 * Iron Fitting (construction, 115s) requires 3x Iron Bar.
 * Iron Bar (smelting, 20.9s) requires 1x Iron Ore (mining, 20.9s) + 1x Coal (mining, 10.9s).
 *
 * The resolver must recursively traverse the dependency tree so that each mode
 * correctly accumulates gather/craft time for ALL levels, not just the top level.
 *
 * Expected values:
 *   Buy All:     time=115s,   baseCost = 3 * Iron Bar market price (84g at 28g/bar)
 *   Gather:      time=240.4s, baseCost = 3 * Coal market price (16.8g at 5.6g/coal)
 *                  115 + 3*(20.9 smelt + 20.9 mine ore) = 115 + 125.4 = 240.4
 *   Gather All:  time=273.1s, baseCost = 0g (gather everything)
 *                  115 + 3*(20.9 smelt + 20.9 mine ore + 10.9 mine coal) = 115 + 158.1 = 273.1
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

describe('Iron Fitting multi-level recursive recipe resolution', () => {
  beforeEach(() => {
    localStorage.clear()
    const dataProvider = useDataProvider()
    dataProvider.clearAllOverrides()
  })

  // --- Prerequisite data checks ---

  it('Iron Bar should have a non-zero currentPrice in resourceRecipes', () => {
    const ironBarRecipe = defaultData.resourceRecipes?.find((r) => r.name === 'Iron Bar')
    expect(ironBarRecipe).toBeDefined()
    expect(ironBarRecipe!.currentPrice).toBeGreaterThan(0)
  })

  it('Iron Fitting recipe should exist in resourceRecipes and use Iron Bar as material', () => {
    const ironFittingRecipe = defaultData.resourceRecipes?.find((r) => r.name === 'Iron Fitting')
    expect(ironFittingRecipe).toBeDefined()
    const ironBarMaterial = ironFittingRecipe!.materials.find((m) => m.name === 'Iron Bar')
    expect(ironBarMaterial).toBeDefined()
    expect(ironBarMaterial!.quantity).toBe(3)
  })

  it('Iron Bar recipe should use Iron Ore and Coal as materials', () => {
    const ironBarRecipe = defaultData.resourceRecipes?.find((r) => r.name === 'Iron Bar')
    expect(ironBarRecipe).toBeDefined()
    const ironOreMat = ironBarRecipe!.materials.find((m) => m.name === 'Iron Ore')
    const coalMat = ironBarRecipe!.materials.find((m) => m.name === 'Coal')
    expect(ironOreMat).toBeDefined()
    expect(ironOreMat!.quantity).toBe(1)
    expect(coalMat).toBeDefined()
    expect(coalMat!.quantity).toBe(1)
  })

  // --- Buy All mode ---

  it('Iron Fitting buy-all: timeSeconds should equal recipe craft time only (115s)', () => {
    const dataProvider = useDataProvider()
    const entry = dataProvider.resourceGathering.value.find((g) => g.name === 'Iron Fitting')
    expect(entry).toBeDefined()
    // Buy All only includes the top-level recipe craft time
    expect(entry!.timeSeconds).toBeCloseTo(115, 1)
  })

  it('Iron Fitting buy-all: baseCost should equal Iron Bar market price * 3', () => {
    const dataProvider = useDataProvider()
    const ironBarRecipe = defaultData.resourceRecipes.find((r) => r.name === 'Iron Bar')!
    const expectedCost = ironBarRecipe.currentPrice * 3

    const entry = dataProvider.resourceGathering.value.find((g) => g.name === 'Iron Fitting')
    expect(entry).toBeDefined()
    expect(entry!.baseCost).toBeCloseTo(expectedCost, 2)
  })

  // --- Gather (except coal) mode ---

  it('Iron Fitting gather: timeSeconds should include smelt + mine ore for each Iron Bar (240.4s)', () => {
    // 115 (craft fitting) + 3 * (20.9 smelt bar + 20.9 mine ore) = 115 + 125.4 = 240.4
    const dataProvider = useDataProvider()
    const entry = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    expect(entry).toBeDefined()
    expect(entry!.timeSeconds).toBeCloseTo(240.4, 1)
  })

  it('Iron Fitting gather: baseCost should equal Coal market price * 3 (coal bought, not gathered)', () => {
    // Coal is excluded from gathering and bought at market price instead.
    // Iron Bar needs 1 Coal, so Iron Fitting needs 3 Coal total.
    const dataProvider = useDataProvider()
    const coalData = defaultData.resourceGathering.find((r) => r.name === 'Coal')!
    const expectedBaseCost = coalData.marketPrice * 3 // 5.6g * 3 = 16.8g

    const entry = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    expect(entry).toBeDefined()
    expect(entry!.baseCost).toBeCloseTo(expectedBaseCost, 2)
  })

  // --- Gather All mode ---

  it('Iron Fitting gather all: timeSeconds should include smelt + mine ore + mine coal (273.1s)', () => {
    // 115 (craft fitting) + 3 * (20.9 smelt + 20.9 mine ore + 10.9 mine coal) = 115 + 158.1 = 273.1
    const dataProvider = useDataProvider()
    const entry = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather all)',
    )
    expect(entry).toBeDefined()
    expect(entry!.timeSeconds).toBeCloseTo(273.1, 1)
  })

  it('Iron Fitting gather all: baseCost should be 0 (everything gathered, no market purchases)', () => {
    const dataProvider = useDataProvider()
    const entry = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather all)',
    )
    expect(entry).toBeDefined()
    expect(entry!.baseCost).toBeCloseTo(0, 2)
  })

  // --- Ordering invariants ---

  it('gather mode should have more timeSeconds than buy-all mode', () => {
    const dataProvider = useDataProvider()
    const buyAll = dataProvider.resourceGathering.value.find((g) => g.name === 'Iron Fitting')
    const gather = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    expect(buyAll).toBeDefined()
    expect(gather).toBeDefined()
    expect(gather!.timeSeconds).toBeGreaterThan(buyAll!.timeSeconds)
  })

  it('gather all mode should have more timeSeconds than gather mode (coal gather time added)', () => {
    const dataProvider = useDataProvider()
    const gather = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    const gatherAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather all)',
    )
    expect(gather).toBeDefined()
    expect(gatherAll).toBeDefined()
    // Gather all adds coal mining time (3 * 10.9s = 32.7s) compared to gather
    expect(gatherAll!.timeSeconds).toBeGreaterThan(gather!.timeSeconds)
  })

  it('gather all mode should have lower baseCost than gather mode (no coal purchase)', () => {
    const dataProvider = useDataProvider()
    const gather = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather)',
    )
    const gatherAll = dataProvider.resourceGathering.value.find(
      (g) => g.name === 'Iron Fitting (gather all)',
    )
    expect(gather).toBeDefined()
    expect(gatherAll).toBeDefined()
    // Gather mode has coal purchase cost; gather all has zero base cost
    expect(gatherAll!.baseCost).toBeLessThan(gather!.baseCost)
  })
})
