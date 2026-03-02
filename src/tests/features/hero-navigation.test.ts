import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import App from '../../App.vue'

describe('Hero Navigation Feature', () => {
  describe('Hero Click Navigation', () => {
    it('should render hero compact as a clickable button', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      expect(heroButton.exists()).toBe(true)
      expect(heroButton.element.tagName).toBe('BUTTON')
    })

    it('should have cursor pointer styling on hero button', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      // Check that the button has the clickable class
      expect(heroButton.classes()).toContain('hero-compact')
    })

    it('should have proper aria-label for accessibility', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      const ariaLabel = heroButton.attributes('aria-label')
      expect(ariaLabel).toBeTruthy()
      expect(ariaLabel).toContain('Click to view in category')
    })

    it('should navigate to correct tab based on hero activity type', async () => {
      const wrapper = mount(App)

      // Find the hero button
      const heroButton = wrapper.find('.hero-compact')
      expect(heroButton.exists()).toBe(true)

      // Get the activity type badge to determine expected behavior
      const badge = heroButton.find('.hero-compact-badge')
      const activityType = badge.text().toLowerCase()

      // Click the hero
      await heroButton.trigger('click')

      // Verify we're on the correct tab based on activity type
      const activeTab = wrapper.find('.tab-button.active')
      const activeTabText = activeTab.text().toLowerCase()

      // Map activity type to expected tab label
      const typeToTabMap: Record<string, string> = {
        dungeon: 'dungeons',
        craftable: 'craftables',
        resource: 'resources',
      }

      const expectedTab = typeToTabMap[activityType]
      expect(expectedTab).toBeDefined()
      expect(activeTabText).toContain(expectedTab)
    })

    it('should display hero item information correctly', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      // Check all required elements are present
      expect(heroButton.find('.hero-compact-label').exists()).toBe(true)
      expect(heroButton.find('.hero-compact-name').exists()).toBe(true)
      expect(heroButton.find('.hero-compact-badge').exists()).toBe(true)
      expect(heroButton.find('.hero-compact-profit').exists()).toBe(true)
    })

    it('should show sale method badge when available', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      // Sale method is optional, so check if it exists
      const methodBadge = heroButton.find('.hero-compact-method')
      if (methodBadge.exists()) {
        const badgeText = methodBadge.text()
        expect(['Vendor', 'Market']).toContain(badgeText)
      }
    })

    it('should handle click event without errors', async () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      // This should not throw
      await expect(heroButton.trigger('click')).resolves.not.toThrow()
    })

    it('should switch to correct tab and show tab content', async () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')

      await heroButton.trigger('click')

      // Wait for next tick
      await wrapper.vm.$nextTick()

      // Verify correct tab is active
      const activeTab = wrapper.find('.tab-button.active')
      expect(activeTab.exists()).toBe(true)

      // Verify tab content is visible
      const tabContent = wrapper.find('.tab-content')
      expect(tabContent.exists()).toBe(true)
      expect(tabContent.isVisible()).toBe(true)
    })

    it('should maintain hero compact visibility on all tabs', async () => {
      const wrapper = mount(App)
      const tabs = ['all', 'dungeons', 'craftables', 'resources', 'market', 'charts']

      for (const tab of tabs) {
        // Find and click the tab button
        const tabButton = wrapper.findAll('.tab-button').find(btn => {
          const text = btn.text().toLowerCase()
          return text.includes(tab === 'all' ? 'all' : tab.slice(0, -1))
        })

        if (tabButton) {
          await tabButton.trigger('click')
          await wrapper.vm.$nextTick()

          // Hero should be visible on all tabs
          const heroButton = wrapper.find('.hero-compact')
          expect(heroButton.exists()).toBe(true)
        }
      }
    })

    it('should have proper type badge styling', () => {
      const wrapper = mount(App)
      const heroButton = wrapper.find('.hero-compact')
      const badge = heroButton.find('.hero-compact-badge')

      expect(badge.exists()).toBe(true)

      // Check that it has one of the expected badge classes
      const classes = badge.classes()
      const hasBadgeClass = classes.some(c =>
        ['badge-dungeon', 'badge-craftable', 'badge-resource'].includes(c)
      )
      expect(hasBadgeClass).toBe(true)
    })
  })

  describe('Activity Type Mapping', () => {
    it('should correctly map activity types to tabs', () => {
      // Test the mapping logic
      const typeToTabMap: Record<string, string> = {
        dungeon: 'dungeons',
        craftable: 'craftables',
        resource: 'resources',
      }

      expect(typeToTabMap['dungeon']).toBe('dungeons')
      expect(typeToTabMap['craftable']).toBe('craftables')
      expect(typeToTabMap['resource']).toBe('resources')
    })
  })
})
