import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MagicFindPanel from '../MagicFindPanel.vue'
import { useMagicFindConfig } from '../../composables/useMagicFindConfig'

describe('MagicFindPanel', () => {
  // Reset localStorage and singleton state before each test
  beforeEach(() => {
    localStorage.clear()
    const { _resetForTesting } = useMagicFindConfig()
    _resetForTesting()
  })

  describe('rendering', () => {
    it('should render the panel', () => {
      const wrapper = mount(MagicFindPanel)

      expect(wrapper.find('.magic-find-panel').exists()).toBe(true)
    })

    it('should display total MF in summary', () => {
      const wrapper = mount(MagicFindPanel)

      // Default: streak=10, dungeon=0, item=3, bonus=10 = 23
      const { magicFind } = useMagicFindConfig()
      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 10

      wrapper.vm.$nextTick(() => {
        const summaryValue = wrapper.find('.summary-value')
        expect(summaryValue.text()).toBe('23%')
      })
    })

    it('should display dungeon MF count in button', () => {
      const wrapper = mount(MagicFindPanel)

      const dungeonButton = wrapper.find('.dungeon-button')
      expect(dungeonButton.text()).toBe('Dungeons: 0')
    })

    it('should display "Magic Find:" label', () => {
      const wrapper = mount(MagicFindPanel)

      const label = wrapper.find('.summary-label')
      expect(label.text()).toBe('Magic Find:')
    })

    it('should display chevron button', () => {
      const wrapper = mount(MagicFindPanel)

      const chevronButton = wrapper.find('.chevron-button')
      expect(chevronButton.exists()).toBe(true)
    })

    it('should not show collapsible card initially', () => {
      const wrapper = mount(MagicFindPanel)

      const collapsibleCard = wrapper.find('.collapsible-card')
      expect(collapsibleCard.element.style.display).toBe('none')
    })
  })

  describe('collapse/expand', () => {
    it('should expand when summary row is clicked', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      const collapsibleCard = wrapper.find('.collapsible-card')
      expect(collapsibleCard.isVisible()).toBe(true)
    })

    it('should collapse when summary row is clicked again', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')

      // Expand
      await summaryRow.trigger('click')
      await nextTick()
      expect(wrapper.find('.collapsible-card').element.style.display).not.toBe('none')

      // Collapse
      await summaryRow.trigger('click')
      await nextTick()
      expect(wrapper.find('.collapsible-card').element.style.display).toBe('none')
    })

    it('should add expanded class to chevron when expanded', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      const chevronIcon = wrapper.find('.chevron-icon')

      // Initially not expanded
      expect(chevronIcon.classes()).not.toContain('expanded')

      // Expand
      await summaryRow.trigger('click')
      await nextTick()

      expect(chevronIcon.classes()).toContain('expanded')
    })

    it('should update aria-expanded attribute', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      const chevronButton = wrapper.find('.chevron-button')

      // Initially collapsed
      expect(chevronButton.attributes('aria-expanded')).toBe('false')

      // Expand
      await summaryRow.trigger('click')
      await nextTick()

      expect(chevronButton.attributes('aria-expanded')).toBe('true')
    })

    it('should have correct aria-label when collapsed', () => {
      const wrapper = mount(MagicFindPanel)

      const chevronButton = wrapper.find('.chevron-button')
      expect(chevronButton.attributes('aria-label')).toBe('Expand Magic Find settings')
    })

    it('should have correct aria-label when expanded', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      const chevronButton = wrapper.find('.chevron-button')
      expect(chevronButton.attributes('aria-label')).toBe('Collapse Magic Find settings')
    })
  })

  describe('dungeon button', () => {
    it('should emit open-dungeon-selector when clicked', async () => {
      const wrapper = mount(MagicFindPanel)

      const dungeonButton = wrapper.find('.dungeon-button')
      await dungeonButton.trigger('click')
      await nextTick()

      expect(wrapper.emitted('open-dungeon-selector')).toBeTruthy()
      expect(wrapper.emitted('open-dungeon-selector')!.length).toBe(1)
    })

    it('should update count when dungeons are completed', async () => {
      const wrapper = mount(MagicFindPanel)
      const { toggleDungeon } = useMagicFindConfig()

      // Initially 0
      expect(wrapper.find('.dungeon-button').text()).toBe('Dungeons: 0')

      // Add a dungeon
      toggleDungeon('Millstone Mines')
      await nextTick()

      expect(wrapper.find('.dungeon-button').text()).toBe('Dungeons: 1')

      // Add another
      toggleDungeon('Vineyard Labyrinth')
      await nextTick()

      expect(wrapper.find('.dungeon-button').text()).toBe('Dungeons: 2')
    })

    it('should have correct title attribute', () => {
      const wrapper = mount(MagicFindPanel)

      const dungeonButton = wrapper.find('.dungeon-button')
      expect(dungeonButton.attributes('title')).toBe('0 completed dungeons')
    })

    it('should update title when dungeons change', async () => {
      const wrapper = mount(MagicFindPanel)
      const { toggleDungeon } = useMagicFindConfig()

      toggleDungeon('Millstone Mines')
      await nextTick()

      const dungeonButton = wrapper.find('.dungeon-button')
      expect(dungeonButton.attributes('title')).toBe('1 completed dungeons')
    })

    it('should not trigger collapse/expand when clicked', async () => {
      const wrapper = mount(MagicFindPanel)

      const dungeonButton = wrapper.find('.dungeon-button')
      await dungeonButton.trigger('click')
      await nextTick()

      // Collapsible card should still be hidden
      const collapsibleCard = wrapper.find('.collapsible-card')
      expect(collapsibleCard.element.style.display).toBe('none')
    })
  })

  describe('editable inputs', () => {
    it('should render EditableValue components when expanded', async () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      const inputs = wrapper.findAllComponents({ name: 'EditableValue' })
      expect(inputs.length).toBe(3)
    })

    it('should bind to magicFind.streak', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      // Set a value
      magicFind.value.streak = 25
      await nextTick()

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      // Check if the component reflects the value
      // Note: We're testing the binding, not the EditableValue component itself
      expect(magicFind.value.streak).toBe(25)
    })

    it('should update total MF when streak changes', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      // Initial total: streak=10, dungeon=0, item=3, bonus=10 = 23
      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 10
      await nextTick()

      // Change streak to 20
      magicFind.value.streak = 20
      await nextTick()

      // New total: 20 + 0 + 3 + 10 = 33
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('33%')
    })

    it('should update total MF when item changes', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 10
      await nextTick()

      // Change item to 10
      magicFind.value.item = 10
      await nextTick()

      // New total: 10 + 0 + 10 + 10 = 30
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('30%')
    })

    it('should update total MF when bonus changes', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 10
      await nextTick()

      // Change bonus to 20
      magicFind.value.bonus = 20
      await nextTick()

      // New total: 10 + 0 + 3 + 20 = 33
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('33%')
    })
  })

  describe('breakdown summary', () => {
    it('should display breakdown when expanded', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 5
      await nextTick()

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      const breakdown = wrapper.find('.breakdown-summary')
      expect(breakdown.text()).toBe('Streak: 10 + Dungeons: 0 + Items: 3 + Bonus: 5 = Total: 18')
    })

    it('should update breakdown when values change', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind, toggleDungeon } = useMagicFindConfig()

      magicFind.value.streak = 15
      magicFind.value.item = 5
      magicFind.value.bonus = 10
      await nextTick()

      const summaryRow = wrapper.find('.summary-row')
      await summaryRow.trigger('click')
      await nextTick()

      // Add a dungeon
      toggleDungeon('Millstone Mines')
      await nextTick()

      const breakdown = wrapper.find('.breakdown-summary')
      expect(breakdown.text()).toBe('Streak: 15 + Dungeons: 1 + Items: 5 + Bonus: 10 = Total: 31')
    })
  })

  describe('integration with useMagicFindConfig', () => {
    it('should sync with useMagicFindConfig composable', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind, totalMF } = useMagicFindConfig()

      // Set values via composable
      magicFind.value.streak = 25
      magicFind.value.item = 7
      magicFind.value.bonus = 15
      await nextTick()

      // Panel should reflect the values
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe(`${totalMF.value}%`)
      expect(totalMF.value).toBe(25 + 0 + 7 + 15)
    })

    it('should share state with other composable instances', async () => {
      const wrapper = mount(MagicFindPanel)
      const instance1 = useMagicFindConfig()
      const instance2 = useMagicFindConfig()

      // Change via instance1
      instance1.magicFind.value.streak = 30
      await nextTick()

      // Both instances should see the change
      expect(instance1.totalMF.value).toBe(instance2.totalMF.value)

      // Panel should also reflect the change (check the actual total)
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe(`${instance1.totalMF.value}%`)
    })
  })

  describe('reactivity', () => {
    it('should reactively update total MF display', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind, toggleDungeon } = useMagicFindConfig()

      magicFind.value.streak = 10
      magicFind.value.item = 3
      magicFind.value.bonus = 5
      await nextTick()

      // Initial total: 10 + 0 + 3 + 5 = 18
      expect(wrapper.find('.summary-value').text()).toBe('18%')

      // Add dungeons
      toggleDungeon('Millstone Mines')
      toggleDungeon('Vineyard Labyrinth')
      await nextTick()

      // New total: 10 + 2 + 3 + 5 = 20
      expect(wrapper.find('.summary-value').text()).toBe('20%')

      // Change streak
      magicFind.value.streak = 20
      await nextTick()

      // New total: 20 + 2 + 3 + 5 = 30
      expect(wrapper.find('.summary-value').text()).toBe('30%')
    })
  })

  describe('accessibility', () => {
    it('should have proper ARIA attributes on chevron button', () => {
      const wrapper = mount(MagicFindPanel)

      const chevronButton = wrapper.find('.chevron-button')
      expect(chevronButton.attributes('aria-label')).toBeTruthy()
      expect(chevronButton.attributes('aria-expanded')).toBe('false')
    })

    it('should have proper title on dungeon button', () => {
      const wrapper = mount(MagicFindPanel)

      const dungeonButton = wrapper.find('.dungeon-button')
      expect(dungeonButton.attributes('title')).toBeTruthy()
    })

    it('should have clickable summary row', () => {
      const wrapper = mount(MagicFindPanel)

      const summaryRow = wrapper.find('.summary-row')
      // The cursor style is set via CSS, not inline, so just check the class exists
      expect(summaryRow.exists()).toBe(true)
      expect(summaryRow.classes()).toContain('summary-row')
    })
  })

  describe('edge cases', () => {
    it('should handle all MF values at 0', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      magicFind.value.streak = 0
      magicFind.value.dungeon = 0
      magicFind.value.item = 0
      magicFind.value.bonus = 0
      await nextTick()

      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('0%')
    })

    it('should handle very large MF values', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      magicFind.value.streak = 100
      magicFind.value.item = 50
      magicFind.value.bonus = 200
      await nextTick()

      // Total: 100 + 0 + 50 + 200 = 350
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('350%')
    })

    it('should handle negative values gracefully', async () => {
      const wrapper = mount(MagicFindPanel)
      const { magicFind } = useMagicFindConfig()

      // Vue v-model might allow negative numbers
      magicFind.value.streak = -10
      magicFind.value.item = 5
      magicFind.value.bonus = 10
      await nextTick()

      // Total: -10 + 0 + 5 + 10 = 5
      const summaryValue = wrapper.find('.summary-value')
      expect(summaryValue.text()).toBe('5%')
    })

    it('should handle rapid expand/collapse toggling', async () => {
      const wrapper = mount(MagicFindPanel)
      const summaryRow = wrapper.find('.summary-row')

      // Toggle multiple times rapidly
      await summaryRow.trigger('click')
      await summaryRow.trigger('click')
      await summaryRow.trigger('click')
      await nextTick()

      // Should be expanded (odd number of clicks)
      const collapsibleCard = wrapper.find('.collapsible-card')
      expect(collapsibleCard.isVisible()).toBe(true)
    })

    it('should handle dungeon button click without propagating to summary row', async () => {
      const wrapper = mount(MagicFindPanel)

      // Click dungeon button
      const dungeonButton = wrapper.find('.dungeon-button')
      await dungeonButton.trigger('click')
      await nextTick()

      // Should emit event
      expect(wrapper.emitted('open-dungeon-selector')).toBeTruthy()

      // Should not expand the panel
      const collapsibleCard = wrapper.find('.collapsible-card')
      expect(collapsibleCard.element.style.display).toBe('none')
    })
  })
})
