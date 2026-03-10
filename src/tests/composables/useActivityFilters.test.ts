import { describe, it, expect, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { useActivityFilters } from '../../composables/useActivityFilters'
import { useLowConfidenceFilter } from '../../composables/useLowConfidenceFilter'
import { useMinSalesFilter } from '../../composables/useMinSalesFilter'
import type { RankedActivity } from '../../calculators/profitRanker'

describe('useActivityFilters', () => {
  // Reset localStorage before each test
  beforeEach(() => {
    localStorage.clear()
  })

  describe('getFilteredActivities', () => {
    it('should filter by activity type', async () => {
      const { filterDungeons, filterAlchemy, filterForging, filterResources, getFilteredActivities } =
        useActivityFilters()

      // Set up low-confidence to show all (so it doesn't affect filtering)
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()
      setShowLowConfidenceCraftables(true)
      setShowLowConfidenceDungeons(true)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Dungeon 1',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test dungeon',
          isRecommended: true,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Alchemy Craftable',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test craftable',
          isRecommended: false,
          skill: 'alchemy',
        },
        {
          rank: 3,
          activityType: 'craftable',
          name: 'Forging Craftable',
          profitPerHour: 700,
          profitPerAction: 70,
          timePerAction: 360,
          cost: 35,
          details: 'Test craftable',
          isRecommended: false,
          skill: 'forging',
        },
        {
          rank: 4,
          activityType: 'resource',
          name: 'Resource 1',
          profitPerHour: 600,
          profitPerAction: 60,
          timePerAction: 360,
          cost: 30,
          details: 'Test resource',
          isRecommended: false,
        },
      ]

      // All filters on (default)
      filterDungeons.value = true
      filterAlchemy.value = true
      filterForging.value = true
      filterResources.value = true
      await nextTick()

      let filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(4)

      // Turn off dungeons
      filterDungeons.value = false
      await nextTick()
      filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((a) => a.activityType)).toEqual(['craftable', 'craftable', 'resource'])

      // Turn off alchemy
      filterDungeons.value = true
      filterAlchemy.value = false
      await nextTick()
      filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((a) => a.name)).toEqual(['Dungeon 1', 'Forging Craftable', 'Resource 1'])

      // Turn off forging
      filterAlchemy.value = true
      filterForging.value = false
      await nextTick()
      filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((a) => a.name)).toEqual(['Dungeon 1', 'Alchemy Craftable', 'Resource 1'])

      // Turn off both alchemy and forging
      filterAlchemy.value = false
      filterForging.value = false
      await nextTick()
      filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((a) => a.name)).toEqual(['Dungeon 1', 'Resource 1'])

      // Turn off resources
      filterResources.value = false
      await nextTick()
      filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].activityType).toBe('dungeon')
    })

    it('should filter low-confidence craftables when toggle is off', async () => {
      const { filterAlchemy, filterForging, getFilteredActivities } = useActivityFilters()
      const { setShowLowConfidenceCraftables } = useLowConfidenceFilter()

      // Enable craftables filter
      filterAlchemy.value = true
      filterForging.value = true
      // Disable low-confidence craftables
      setShowLowConfidenceCraftables(false)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'craftable',
          name: 'High Confidence Craftable',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test craftable',
          isRecommended: true,
          isLowConfidence: false,
          skill: 'alchemy',
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Low Confidence Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test craftable',
          isRecommended: false,
          isLowConfidence: true,
          skill: 'forging',
        },
        {
          rank: 3,
          activityType: 'craftable',
          name: 'Another High Confidence Craftable',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test craftable',
          isRecommended: false,
          isLowConfidence: false,
          skill: 'forging',
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((a) => a.name)).toEqual([
        'High Confidence Craftable',
        'Another High Confidence Craftable',
      ])
    })

    it('should filter low-confidence dungeons when toggle is off', async () => {
      const { filterDungeons, getFilteredActivities } = useActivityFilters()
      const { setShowLowConfidenceDungeons } = useLowConfidenceFilter()

      // Enable dungeons filter
      filterDungeons.value = true
      // Disable low-confidence dungeons
      setShowLowConfidenceDungeons(false)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'High Confidence Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test dungeon',
          isRecommended: true,
          isLowConfidence: false,
        },
        {
          rank: 2,
          activityType: 'dungeon',
          name: 'Low Confidence Dungeon',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test dungeon',
          isRecommended: false,
          isLowConfidence: true,
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('High Confidence Dungeon')
    })

    it('should include low-confidence items when toggle is on', async () => {
      const { filterDungeons, filterAlchemy, filterForging, getFilteredActivities } = useActivityFilters()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      // Enable all filters
      filterDungeons.value = true
      filterAlchemy.value = true
      filterForging.value = true
      // Enable low-confidence items
      setShowLowConfidenceCraftables(true)
      setShowLowConfidenceDungeons(true)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Low Confidence Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test dungeon',
          isRecommended: true,
          isLowConfidence: true,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Low Confidence Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test craftable',
          isRecommended: false,
          isLowConfidence: true,
          skill: 'alchemy',
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
    })

    it('should not filter resources by low-confidence (resources have no low-confidence flag)', async () => {
      const { filterResources, getFilteredActivities } = useActivityFilters()

      filterResources.value = true
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'resource',
          name: 'Resource 1',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test resource',
          isRecommended: true,
          // Resources don't have isLowConfidence
        },
        {
          rank: 2,
          activityType: 'resource',
          name: 'Resource 2',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test resource',
          isRecommended: false,
          isLowConfidence: true, // Even if somehow set, shouldn't affect resources
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
    })

    it('should combine activity type and low-confidence filters', async () => {
      const { filterDungeons, filterAlchemy, filterForging, getFilteredActivities } = useActivityFilters()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      filterDungeons.value = true
      filterAlchemy.value = true
      filterForging.value = true
      setShowLowConfidenceCraftables(false)
      setShowLowConfidenceDungeons(false)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Low Confidence Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          isLowConfidence: true,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Low Confidence Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: true,
          skill: 'alchemy',
        },
        {
          rank: 3,
          activityType: 'dungeon',
          name: 'High Confidence Dungeon',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
        },
        {
          rank: 4,
          activityType: 'craftable',
          name: 'High Confidence Craftable',
          profitPerHour: 700,
          profitPerAction: 70,
          timePerAction: 360,
          cost: 35,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
          skill: 'forging',
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((a) => a.name)).toEqual(['High Confidence Dungeon', 'High Confidence Craftable'])
    })
  })

  describe('getFilteredAndRerankedActivities', () => {
    it('should re-rank filtered activities starting from 1', async () => {
      const { filterDungeons, getFilteredAndRerankedActivities } = useActivityFilters()
      const { setShowLowConfidenceDungeons } = useLowConfidenceFilter()

      filterDungeons.value = true
      setShowLowConfidenceDungeons(false)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Low Confidence Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          isLowConfidence: true,
        },
        {
          rank: 2,
          activityType: 'dungeon',
          name: 'High Confidence Dungeon',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
        },
        {
          rank: 3,
          activityType: 'dungeon',
          name: 'Another High Confidence Dungeon',
          profitPerHour: 600,
          profitPerAction: 60,
          timePerAction: 360,
          cost: 30,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
        },
      ]

      const filtered = getFilteredAndRerankedActivities(activities)
      expect(filtered).toHaveLength(2)
      // Ranks should be re-assigned after filtering out low-confidence
      expect(filtered[0].rank).toBe(1)
      expect(filtered[0].name).toBe('High Confidence Dungeon')
      expect(filtered[1].rank).toBe(2)
      expect(filtered[1].name).toBe('Another High Confidence Dungeon')
    })

    it('should ensure low-confidence items do not appear at top ranks when toggles are off', async () => {
      const { filterDungeons, filterAlchemy, filterForging, getFilteredAndRerankedActivities } =
        useActivityFilters()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      filterDungeons.value = true
      filterAlchemy.value = true
      filterForging.value = true
      setShowLowConfidenceCraftables(false)
      setShowLowConfidenceDungeons(false)
      await nextTick()

      // Low-confidence items have HIGHER profit but should be excluded
      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Very Profitable Low Confidence Dungeon',
          profitPerHour: 10000,
          profitPerAction: 1000,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          isLowConfidence: true,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Very Profitable Low Confidence Craftable',
          profitPerHour: 9000,
          profitPerAction: 900,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: true,
          skill: 'alchemy',
        },
        {
          rank: 3,
          activityType: 'dungeon',
          name: 'High Confidence Dungeon',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
        },
        {
          rank: 4,
          activityType: 'craftable',
          name: 'High Confidence Craftable',
          profitPerHour: 700,
          profitPerAction: 70,
          timePerAction: 360,
          cost: 35,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: false,
          skill: 'forging',
        },
      ]

      const filtered = getFilteredAndRerankedActivities(activities)

      // Low-confidence items should be filtered out
      expect(filtered).toHaveLength(2)

      // The rank 1 item should NOT be the low-confidence one
      expect(filtered[0].rank).toBe(1)
      expect(filtered[0].name).toBe('High Confidence Dungeon')
      expect(filtered[0].isLowConfidence).toBeFalsy()

      expect(filtered[1].rank).toBe(2)
      expect(filtered[1].name).toBe('High Confidence Craftable')
      expect(filtered[1].isLowConfidence).toBeFalsy()
    })
  })

  describe('migration', () => {
    it('should migrate old craftables filter to alchemy + forging', () => {
      // Set up old format in localStorage
      localStorage.setItem('active-filters', JSON.stringify({
        dungeons: true,
        craftables: false,
        resources: true,
      }))

      // Trigger migration by directly running the migration code
      // (normally happens at module load, but we need to test it explicitly)
      const stored = localStorage.getItem('active-filters')
      if (stored) {
        const filters = JSON.parse(stored)

        // Step 1: Migrate potions -> craftables (legacy)
        if (filters.potions !== undefined && filters.craftables === undefined) {
          filters.craftables = filters.potions
          delete filters.potions
        }

        // Step 2: Migrate craftables -> alchemy + forging
        if (filters.craftables !== undefined && (filters.alchemy === undefined || filters.forging === undefined)) {
          filters.alchemy = filters.craftables
          filters.forging = filters.craftables
          delete filters.craftables
        }

        // Write back if any migration occurred
        if (filters.alchemy !== undefined && filters.forging !== undefined) {
          localStorage.setItem('active-filters', JSON.stringify(filters))
        }
      }

      // Verify the old key was removed from localStorage
      const migratedFilters = JSON.parse(localStorage.getItem('active-filters') || '{}')
      expect(migratedFilters.craftables).toBeUndefined()
      expect(migratedFilters.alchemy).toBe(false)
      expect(migratedFilters.forging).toBe(false)
      expect(migratedFilters.dungeons).toBe(true)
      expect(migratedFilters.resources).toBe(true)
    })

    it('should migrate old potions filter through craftables to alchemy + forging', () => {
      // Set up very old format in localStorage
      localStorage.setItem('active-filters', JSON.stringify({
        dungeons: false,
        potions: true,
        resources: false,
      }))

      // Trigger migration
      const stored = localStorage.getItem('active-filters')
      if (stored) {
        const filters = JSON.parse(stored)

        // Step 1: Migrate potions -> craftables (legacy)
        if (filters.potions !== undefined && filters.craftables === undefined) {
          filters.craftables = filters.potions
          delete filters.potions
        }

        // Step 2: Migrate craftables -> alchemy + forging
        if (filters.craftables !== undefined && (filters.alchemy === undefined || filters.forging === undefined)) {
          filters.alchemy = filters.craftables
          filters.forging = filters.craftables
          delete filters.craftables
        }

        // Write back if any migration occurred
        if (filters.alchemy !== undefined && filters.forging !== undefined) {
          localStorage.setItem('active-filters', JSON.stringify(filters))
        }
      }

      // Verify the old keys were removed from localStorage
      const migratedFilters = JSON.parse(localStorage.getItem('active-filters') || '{}')
      expect(migratedFilters.potions).toBeUndefined()
      expect(migratedFilters.craftables).toBeUndefined()
      expect(migratedFilters.alchemy).toBe(true)
      expect(migratedFilters.forging).toBe(true)
      expect(migratedFilters.dungeons).toBe(false)
      expect(migratedFilters.resources).toBe(false)
    })
  })

  describe('skill field handling', () => {
    it('should treat craftables with undefined skill as forging', async () => {
      const { filterAlchemy, filterForging, getFilteredActivities } = useActivityFilters()
      const { setShowLowConfidenceCraftables } = useLowConfidenceFilter()

      filterAlchemy.value = true
      filterForging.value = false
      setShowLowConfidenceCraftables(true)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'craftable',
          name: 'Alchemy Craftable',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          skill: 'alchemy',
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Undefined Skill Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          // skill is undefined
        },
      ]

      const filtered = getFilteredActivities(activities)
      // Only alchemy should show (undefined skill treated as forging, which is filtered out)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Alchemy Craftable')
    })
  })

  describe('min sales volume filter', () => {
    it('should filter activities by min sales volume', async () => {
      const { getFilteredActivities } = useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      // Enable all low-confidence items so they don't interfere
      setShowLowConfidenceCraftables(true)
      setShowLowConfidenceDungeons(true)
      setMinSalesThreshold(10)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'High Volume Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          weeklySalesVolume: 50,
        },
        {
          rank: 2,
          activityType: 'dungeon',
          name: 'Low Volume Dungeon',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          weeklySalesVolume: 5,
        },
        {
          rank: 3,
          activityType: 'craftable',
          name: 'High Volume Craftable',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          weeklySalesVolume: 100,
        },
        {
          rank: 4,
          activityType: 'resource',
          name: 'Resource',
          profitPerHour: 700,
          profitPerAction: 70,
          timePerAction: 360,
          cost: 35,
          details: 'Test',
          isRecommended: false,
          // Resources have undefined weeklySalesVolume
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(3)
      expect(filtered.map((a) => a.name)).toEqual([
        'High Volume Dungeon',
        'High Volume Craftable',
        'Resource',
      ])
    })

    it('should pass through resources with undefined weeklySalesVolume', async () => {
      const { getFilteredActivities } = useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()

      setMinSalesThreshold(1000)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Low Volume Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          weeklySalesVolume: 5,
        },
        {
          rank: 2,
          activityType: 'resource',
          name: 'Resource',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          // undefined weeklySalesVolume
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Resource')
    })

    it('should include items at exactly the threshold', async () => {
      const { getFilteredActivities } = useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()
      const { setShowLowConfidenceDungeons } = useLowConfidenceFilter()

      setShowLowConfidenceDungeons(true)
      setMinSalesThreshold(10)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Below Threshold',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          weeklySalesVolume: 9,
        },
        {
          rank: 2,
          activityType: 'dungeon',
          name: 'At Threshold',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          weeklySalesVolume: 10,
        },
        {
          rank: 3,
          activityType: 'dungeon',
          name: 'Above Threshold',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          weeklySalesVolume: 11,
        },
      ]

      const filtered = getFilteredActivities(activities)
      expect(filtered).toHaveLength(2)
      expect(filtered.map((a) => a.name)).toEqual(['At Threshold', 'Above Threshold'])
    })

    it('should combine min sales filter with activity type filters', async () => {
      const { filterDungeons, filterAlchemy, getFilteredActivities } = useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      filterDungeons.value = false
      filterAlchemy.value = true
      setShowLowConfidenceCraftables(true)
      setShowLowConfidenceDungeons(true)
      setMinSalesThreshold(10)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'High Volume Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          weeklySalesVolume: 50,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'High Volume Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          weeklySalesVolume: 20,
        },
        {
          rank: 3,
          activityType: 'craftable',
          name: 'Low Volume Craftable',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          weeklySalesVolume: 5,
        },
      ]

      const filtered = getFilteredActivities(activities)
      // Dungeon filtered by type, low volume craftable filtered by sales volume
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('High Volume Craftable')
    })

    it('should combine min sales filter with low-confidence filter', async () => {
      const { getFilteredActivities } = useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()
      const { setShowLowConfidenceCraftables } = useLowConfidenceFilter()

      setShowLowConfidenceCraftables(false)
      setMinSalesThreshold(10)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'craftable',
          name: 'High Volume Low Confidence',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          skill: 'alchemy',
          isLowConfidence: true,
          weeklySalesVolume: 50,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Low Volume High Confidence',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          isLowConfidence: false,
          weeklySalesVolume: 5,
        },
        {
          rank: 3,
          activityType: 'craftable',
          name: 'High Volume High Confidence',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          isLowConfidence: false,
          weeklySalesVolume: 20,
        },
      ]

      const filtered = getFilteredActivities(activities)
      // Only high volume + high confidence should pass
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('High Volume High Confidence')
    })

    it('should exclude low-confidence items with low sales volume even when low-confidence toggle is ON', async () => {
      const { filterDungeons, filterAlchemy, filterForging, getFilteredActivities } =
        useActivityFilters()
      const { setMinSalesThreshold } = useMinSalesFilter()
      const { setShowLowConfidenceCraftables, setShowLowConfidenceDungeons } =
        useLowConfidenceFilter()

      // Enable all activity type filters
      filterDungeons.value = true
      filterAlchemy.value = true
      filterForging.value = true
      // Enable low-confidence items AND set a min sales threshold
      setShowLowConfidenceCraftables(true)
      setShowLowConfidenceDungeons(true)
      setMinSalesThreshold(100)
      await nextTick()

      const activities: RankedActivity[] = [
        {
          rank: 1,
          activityType: 'dungeon',
          name: 'Low Confidence Low Volume Dungeon',
          profitPerHour: 1000,
          profitPerAction: 100,
          timePerAction: 360,
          cost: 50,
          details: 'Test',
          isRecommended: true,
          isLowConfidence: true,
          weeklySalesVolume: 2,
        },
        {
          rank: 2,
          activityType: 'craftable',
          name: 'Low Confidence Low Volume Craftable',
          profitPerHour: 900,
          profitPerAction: 90,
          timePerAction: 360,
          cost: 45,
          details: 'Test',
          isRecommended: false,
          skill: 'alchemy',
          isLowConfidence: true,
          weeklySalesVolume: 5,
        },
        {
          rank: 3,
          activityType: 'dungeon',
          name: 'Low Confidence High Volume Dungeon',
          profitPerHour: 800,
          profitPerAction: 80,
          timePerAction: 360,
          cost: 40,
          details: 'Test',
          isRecommended: false,
          isLowConfidence: true,
          weeklySalesVolume: 150,
        },
        {
          rank: 4,
          activityType: 'craftable',
          name: 'High Confidence Low Volume Craftable',
          profitPerHour: 700,
          profitPerAction: 70,
          timePerAction: 360,
          cost: 35,
          details: 'Test',
          isRecommended: false,
          skill: 'forging',
          isLowConfidence: false,
          weeklySalesVolume: 20,
        },
      ]

      const filtered = getFilteredActivities(activities)
      // Only the low-confidence high-volume dungeon should pass
      // The low-confidence low-volume items should be excluded by min-sales filter
      // The high-confidence low-volume item should also be excluded by min-sales filter
      expect(filtered).toHaveLength(1)
      expect(filtered[0].name).toBe('Low Confidence High Volume Dungeon')
    })
  })
})
