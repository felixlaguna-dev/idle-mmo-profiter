<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useDataProvider } from './composables/useDataProvider'
import { useRecipePricing } from './composables/useRecipePricing'
import { useProfitRanking } from './composables/useProfitRanking'
import { useStorage } from './composables/useStorage'
import { useActivityFilters } from './composables/useActivityFilters'
import { useStaticMode } from './composables/useStaticMode'
import { calculateDungeonProfits } from './calculators/dungeonCalculator'
import { calculateCraftableProfits } from './calculators/craftableCalculator'
import { calculateResourceProfits } from './calculators/resourceCalculator'
import { getBestAction } from './calculators/profitRanker'
import SettingsPanel from './components/SettingsPanel.vue'
import ProfitRankingTable from './components/ProfitRankingTable.vue'
import DungeonTable from './components/DungeonTable.vue'
import CraftableTable from './components/CraftableTable.vue'
import ResourceTable from './components/ResourceTable.vue'
import MarketTable from './components/MarketTable.vue'
import Toast from './components/Toast.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import LoadingSpinner from './components/LoadingSpinner.vue'
import AppFooter from './components/AppFooter.vue'
import { useToast } from './composables/useToast'
import type { MagicFindSettings } from './types'

const { isStaticMode } = useStaticMode()

// Lazy load chart components for better performance
const ProfitBarChart = defineAsyncComponent(() => import('./components/charts/ProfitBarChart.vue'))
const DungeonChart = defineAsyncComponent(() => import('./components/charts/DungeonChart.vue'))
const RevenueBreakdown = defineAsyncComponent(
  () => import('./components/charts/RevenueBreakdown.vue')
)
const PriceHistoryChart = defineAsyncComponent(
  () => import('./components/charts/PriceHistoryChart.vue')
)

// Current tab state
type Tab = 'all' | 'dungeons' | 'craftables' | 'resources' | 'market' | 'charts'
const currentTab = ref<Tab>('all')

// Settings modal state
const showSettings = ref(false)
// eslint-disable-next-line no-undef
const modalCloseButtonRef = ref<HTMLButtonElement | null>(null)
 
const modalContentRef = ref<HTMLElement | null>(null)

// Toast notifications
const { toasts, dismissToast } = useToast()

// Track previous focus for modal
let previousFocus: HTMLElement | null = null

// Open settings and manage focus
const openSettings = () => {
  previousFocus = document.activeElement as HTMLElement
  showSettings.value = true
  // Focus modal close button on next tick
  setTimeout(() => {
    modalCloseButtonRef.value?.focus()
  }, 100)
}

// Close settings and restore focus
const closeSettings = () => {
  showSettings.value = false
  // Restore focus to settings button
  setTimeout(() => {
    previousFocus?.focus()
  }, 100)
}

// Get data from data provider
const dataProvider = useDataProvider()

// Get override stats for Market tab badge
const overrideStats = computed(() => dataProvider.getOverrideStats())

// Get settings from storage
const magicFind = useStorage<MagicFindSettings>('magicFind', {
  streak: 10,
  dungeon: 13,
  item: 3,
  bonus: 10,
})
const marketTaxRate = useStorage<number>('marketTaxRate', 0.12)

// Compute recipe prices with untradable recipe pricing
const { recipesWithComputedPrices } = useRecipePricing(
  dataProvider.recipes,
  dataProvider.craftableRecipes,
  marketTaxRate
)

// Calculate profit rankings
const { rankedActivities } = useProfitRanking({
  dungeons: dataProvider.dungeons,
  recipes: recipesWithComputedPrices,
  craftableRecipes: dataProvider.craftableRecipes,
  resourceGathering: dataProvider.resourceGathering,
  magicFind: computed(() => magicFind.value),
  taxRate: computed(() => marketTaxRate.value),
})

// Use shared filter state to get filtered best action
const { getFilteredAndRerankedActivities } = useActivityFilters()

// Best action should reflect current filters
const bestAction = computed(() => {
  const filteredActivities = getFilteredAndRerankedActivities(rankedActivities.value)
  return getBestAction(filteredActivities)
})

// Calculate dungeon profits for dungeon table
const dungeonProfits = computed(() => {
  return calculateDungeonProfits(
    dataProvider.dungeons.value,
    recipesWithComputedPrices.value,
    magicFind.value
  )
})

// Calculate craftable profits for craftable table
const craftableProfits = computed(() => {
  return calculateCraftableProfits(
    dataProvider.craftableRecipes.value,
    marketTaxRate.value,
    dataProvider.recipes.value
  )
})

// Calculate resource profits for resource table
const resourceProfits = computed(() => {
  return calculateResourceProfits(dataProvider.resourceGathering.value, marketTaxRate.value)
})

// Remove a craftable recipe entry
const removeCraftableRecipe = (craftableName: string) => {
  dataProvider.removeCraftableRecipe(craftableName)
}

// Update a craftable recipe time
const updateCraftableRecipeTime = (craftableName: string, value: number) => {
  dataProvider.updateCraftableRecipeTime(craftableName, value)
}

// Last update time (placeholder - will be updated when API is integrated)
const lastUpdateTime = ref<Date | null>(null)

// Format numbers with commas
const formatNumber = (num: number): string => {
  return Math.round(num).toLocaleString()
}

// Format time
const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  }
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  if (remainingSeconds === 0) {
    return `${minutes}m`
  }
  return `${minutes}m ${remainingSeconds}s`
}

// Get last update text
const lastUpdateText = computed(() => {
  if (!lastUpdateTime.value) {
    return 'Using default data'
  }
  return `Last updated: ${lastUpdateTime.value.toLocaleTimeString()}`
})

// Get type badge color
const getTypeBadgeClass = (type: string): string => {
  switch (type) {
    case 'dungeon':
      return 'badge-dungeon'
    case 'craftable':
      return 'badge-craftable'
    case 'resource':
      return 'badge-resource'
    default:
      return ''
  }
}

// Handle tab navigation with arrow keys
const tabs: Tab[] = ['all', 'dungeons', 'craftables', 'resources', 'market', 'charts']

const handleTabKeydown = (e: KeyboardEvent) => {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return

  e.preventDefault()
  const currentIndex = tabs.indexOf(currentTab.value)

  if (e.key === 'ArrowLeft') {
    currentTab.value = tabs[currentIndex > 0 ? currentIndex - 1 : tabs.length - 1]
  } else if (e.key === 'ArrowRight') {
    currentTab.value = tabs[currentIndex < tabs.length - 1 ? currentIndex + 1 : 0]
  } else if (e.key === 'Home') {
    currentTab.value = tabs[0]
  } else if (e.key === 'End') {
    currentTab.value = tabs[tabs.length - 1]
  }

  // Focus the newly selected tab
  setTimeout(() => {
    const activeTab = document.querySelector('.tab-button.active') as HTMLElement
    activeTab?.focus()
  }, 0)
}

// Auto-scroll active tab into view on mobile
const scrollActiveTabIntoView = () => {
  nextTick(() => {
    const activeTab = document.querySelector('.tab-button.active') as HTMLElement
    activeTab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  })
}

watch(currentTab, scrollActiveTabIntoView)

// Get all focusable elements within a container
const getFocusableElements = (container: HTMLElement) => {
  const focusableSelectors = [
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelectors.join(', '))
  ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
}

// Trap focus within modal
const handleModalKeydown = (e: KeyboardEvent) => {
  if (e.key !== 'Tab' || !modalContentRef.value) return

  const focusableElements = getFocusableElements(modalContentRef.value)
  if (focusableElements.length === 0) return

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (e.shiftKey && document.activeElement === firstElement) {
    e.preventDefault()
    lastElement.focus()
  } else if (!e.shiftKey && document.activeElement === lastElement) {
    e.preventDefault()
    firstElement.focus()
  }
}

// Handle keyboard shortcuts
const handleKeydown = (e: KeyboardEvent) => {
  // Escape closes settings modal (skip in static mode)
  if (e.key === 'Escape' && showSettings.value && !isStaticMode) {
    closeSettings()
  }
}

// Add/remove event listeners
onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="app-container">
    <!-- Top Bar -->
    <header class="app-header">
      <div class="header-content">
        <h1 class="app-title">IdleMMO Profit Calculator</h1>
        <div class="header-actions">
          <span class="last-update">{{ lastUpdateText }}</span>
          <button
            v-if="!isStaticMode"
            class="btn-settings"
            title="Settings"
            aria-label="Open settings"
            @click="openSettings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3"></circle>
              <path
                d="M12 1v6m0 6v6m0-6h6m-6 0H6m12.364-6.364l-4.243 4.243m0 0l-4.243 4.243m4.243-4.243l4.243 4.243m-4.243-4.243l-4.243-4.243"
              ></path>
              <path d="M19.071 4.929a10 10 0 0 1 0 14.142m-14.142 0a10 10 0 0 1 0-14.142"></path>
            </svg>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="app-main">
      <div class="content-wrapper">
        <!-- Hero Section: Best Action (Full - All Activities tab only) -->
        <section v-if="bestAction && currentTab === 'all'" class="hero-section" aria-labelledby="best-action-heading">
          <div class="hero-content">
            <p class="hero-label">Best Action Right Now</p>
            <div class="hero-activity">
              <h2 id="best-action-heading" class="hero-name">{{ bestAction.name }}</h2>
              <span class="hero-badge" :class="getTypeBadgeClass(bestAction.activityType)">
                {{ bestAction.activityType }}
              </span>
            </div>
            <div class="hero-profit" aria-label="Profit per hour">
              <span class="hero-profit-value" aria-label="{{ formatNumber(bestAction.profitPerHour) }} gold per hour">{{ formatNumber(bestAction.profitPerHour) }}</span>
              <span class="hero-profit-label" aria-hidden="true">gold/hr</span>
            </div>
            <dl class="hero-details">
              <div class="hero-detail">
                <dt class="detail-label">Profit per action</dt>
                <dd class="detail-value">{{ formatNumber(bestAction.profitPerAction) }} gold</dd>
              </div>
              <div class="hero-detail">
                <dt class="detail-label">Time per action</dt>
                <dd class="detail-value">{{ formatTime(bestAction.timePerAction) }}</dd>
              </div>
              <div class="hero-detail">
                <dt class="detail-label">Cost</dt>
                <dd class="detail-value">{{ formatNumber(bestAction.cost) }} gold</dd>
              </div>
            </dl>
          </div>
        </section>

        <!-- Hero Compact: Best Action (Other tabs) -->
        <div v-if="bestAction && currentTab !== 'all'" class="hero-compact" aria-label="Best action summary">
          <span class="hero-compact-label">Best:</span>
          <span class="hero-compact-name">{{ bestAction.name }}</span>
          <span class="hero-compact-badge" :class="getTypeBadgeClass(bestAction.activityType)">
            {{ bestAction.activityType }}
          </span>
          <span class="hero-compact-separator" aria-hidden="true"></span>
          <span class="hero-compact-profit">{{ formatNumber(bestAction.profitPerHour) }} gold/hr</span>
        </div>

        <!-- Tab Navigation -->
        <div class="tab-navigation-wrapper">
        <nav class="tab-navigation" role="tablist" aria-label="Activity categories">
          <button
            class="tab-button"
            :class="{ active: currentTab === 'all' }"
            role="tab"
            :aria-selected="currentTab === 'all'"
            :tabindex="currentTab === 'all' ? 0 : -1"
            @click="currentTab = 'all'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">All Activities</span>
            <span class="tab-label-short">All</span>
          </button>
          <button
            class="tab-button"
            :class="{ active: currentTab === 'dungeons' }"
            role="tab"
            :aria-selected="currentTab === 'dungeons'"
            :tabindex="currentTab === 'dungeons' ? 0 : -1"
            @click="currentTab = 'dungeons'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">Dungeons</span>
            <span class="tab-label-short">Dung.</span>
          </button>
          <button
            class="tab-button"
            :class="{ active: currentTab === 'craftables' }"
            role="tab"
            :aria-selected="currentTab === 'craftables'"
            :tabindex="currentTab === 'craftables' ? 0 : -1"
            @click="currentTab = 'craftables'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">Craftables</span>
            <span class="tab-label-short">Craft</span>
          </button>
          <button
            class="tab-button"
            :class="{ active: currentTab === 'resources' }"
            role="tab"
            :aria-selected="currentTab === 'resources'"
            :tabindex="currentTab === 'resources' ? 0 : -1"
            @click="currentTab = 'resources'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">Resources</span>
            <span class="tab-label-short">Res.</span>
          </button>
          <button
            class="tab-button"
            :class="{ active: currentTab === 'market' }"
            role="tab"
            :aria-selected="currentTab === 'market'"
            :tabindex="currentTab === 'market' ? 0 : -1"
            @click="currentTab = 'market'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">Market</span>
            <span class="tab-label-short">Mkt.</span>
            <span v-if="overrideStats.total > 0 && !isStaticMode" class="tab-badge">{{
              overrideStats.total
            }}</span>
          </button>
          <button
            class="tab-button"
            :class="{ active: currentTab === 'charts' }"
            role="tab"
            :aria-selected="currentTab === 'charts'"
            :tabindex="currentTab === 'charts' ? 0 : -1"
            @click="currentTab = 'charts'"
            @keydown="handleTabKeydown"
          >
            <span class="tab-label-full">Charts</span>
            <span class="tab-label-short">Charts</span>
          </button>
        </nav>
        </div>

        <!-- Tab Content -->
        <div class="tab-content">
          <ErrorBoundary>
            <div v-if="currentTab === 'all'">
              <ProfitRankingTable :activities="rankedActivities" />
            </div>
            <div v-if="currentTab === 'dungeons'">
              <DungeonTable :dungeons="dungeonProfits" />
            </div>
            <div v-if="currentTab === 'craftables'">
              <CraftableTable
                :craftables="craftableProfits"
                @update:craft-time="updateCraftableRecipeTime"
                @delete:craftable="removeCraftableRecipe"
              />
            </div>
            <div v-if="currentTab === 'resources'">
              <ResourceTable :resources="resourceProfits" />
            </div>
            <div v-if="currentTab === 'market'">
              <MarketTable />
            </div>
            <div v-if="currentTab === 'charts'" class="charts-section">
              <ErrorBoundary>
                <Suspense>
                  <template #default>
                    <ProfitBarChart :activities="rankedActivities" />
                  </template>
                  <template #fallback>
                    <LoadingSpinner message="Loading chart..." :timeout="10000" />
                  </template>
                </Suspense>
              </ErrorBoundary>
              <div class="charts-grid">
                <ErrorBoundary>
                  <Suspense>
                    <template #default>
                      <DungeonChart :dungeons="dungeonProfits" />
                    </template>
                    <template #fallback>
                      <LoadingSpinner message="Loading chart..." :timeout="10000" />
                    </template>
                  </Suspense>
                </ErrorBoundary>
                <ErrorBoundary>
                  <Suspense>
                    <template #default>
                      <RevenueBreakdown :activities="rankedActivities" />
                    </template>
                    <template #fallback>
                      <LoadingSpinner message="Loading chart..." :timeout="10000" />
                    </template>
                  </Suspense>
                </ErrorBoundary>
              </div>
              <ErrorBoundary>
                <Suspense>
                  <template #default>
                    <PriceHistoryChart />
                  </template>
                  <template #fallback>
                    <LoadingSpinner message="Loading chart..." :timeout="10000" />
                  </template>
                </Suspense>
              </ErrorBoundary>
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </main>

    <!-- Settings Modal (hidden in static mode) -->
    <div
      v-if="showSettings && !isStaticMode"
      class="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
      @click.self="closeSettings"
    >
      <div ref="modalContentRef" class="modal-content" @keydown="handleModalKeydown">
        <div class="modal-header">
          <button
            ref="modalCloseButtonRef"
            class="btn-close"
            title="Close"
            aria-label="Close settings"
            @click="closeSettings"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <SettingsPanel />
      </div>
    </div>

    <!-- Footer -->
    <AppFooter />

    <!-- Toast Notifications -->
    <Toast :messages="toasts" @dismiss="dismissToast" />
  </div>
</template>

<style scoped>
.app-container {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* Header */
.app-header {
  background-color: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 2rem;
  position: sticky;
  top: 0;
  z-index: 100;
  /* Performance: GPU acceleration for sticky positioning */
  will-change: transform;
  /* Contain layout shifts */
  contain: layout style paint;
  /* Ensure header fully covers hero section when scrolling */
  box-shadow: 0 1px 0 0 var(--bg-secondary);
}

.header-content {
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.app-title {
  font-size: 1.5rem;
  color: var(--text-primary);
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.last-update {
  font-size: 0.875rem;
  color: #b0b8c4;
  opacity: 1;
}

.btn-settings {
  padding: 0.5rem;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}

.btn-settings:hover {
  background-color: var(--bg-primary);
  color: var(--accent-primary);
  border-color: var(--accent-primary);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.btn-settings:active {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(59, 130, 246, 0.2);
}

/* Main Content */
.app-main {
  flex: 1;
  padding: 2rem;
}

.content-wrapper {
  max-width: 1400px;
  margin: 0 auto;
}

/* Hero Section */
.hero-section {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(245, 158, 11, 0.05) 100%);
  border: 2px solid rgba(245, 158, 11, 0.3);
  border-radius: 0.75rem;
  padding: 2rem;
  margin-bottom: 2rem;
  box-shadow: 0 4px 12px rgba(245, 158, 11, 0.2), 0 8px 24px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease-in-out;
  position: relative;
  overflow: hidden;
}

.hero-section::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(
    90deg,
    var(--warning) 0%,
    var(--accent-primary) 50%,
    var(--warning) 100%
  );
  opacity: 0.5;
}

.hero-section:hover {
  box-shadow: 0 6px 16px rgba(245, 158, 11, 0.25), 0 10px 28px rgba(0, 0, 0, 0.35);
  transform: translateY(-2px);
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hero-label {
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--warning);
  font-weight: 600;
}

.hero-activity {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.hero-name {
  font-size: 2rem;
  color: var(--text-primary);
  font-weight: 700;
  margin: 0;
}

.hero-badge {
  padding: 0.375rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: capitalize;
}

.badge-dungeon {
  background-color: rgba(168, 85, 247, 0.2);
  color: #c084fc;
  border: 1px solid rgba(168, 85, 247, 0.4);
}

.badge-craftable {
  background-color: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.4);
}

.badge-resource {
  background-color: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.4);
}

.hero-profit {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
}

.hero-profit-value {
  font-size: 3rem;
  font-weight: 800;
  color: var(--warning);
  line-height: 1;
}

.hero-profit-label {
  font-size: 1.25rem;
  color: var(--text-secondary);
}

.hero-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-top: 0.5rem;
  margin-bottom: 0;
}

.hero-detail {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  margin: 0;
}

.detail-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  font-weight: 500;
}

.detail-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

/* Hero Compact */
.hero-compact {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1.25rem;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%);
  border: 1px solid rgba(245, 158, 11, 0.25);
  border-radius: 0.5rem;
  font-size: 0.875rem;
  line-height: 1;
  min-height: 44px;
}

.hero-compact-label {
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.75rem;
}

.hero-compact-name {
  font-weight: 700;
  color: var(--text-primary);
  font-size: 0.9375rem;
}

.hero-compact-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: capitalize;
}

.hero-compact-separator {
  display: inline-block;
  width: 2px;
  height: 14px;
  background-color: var(--border-color);
  margin: 0 0.625rem;
  vertical-align: middle;
  opacity: 0.5;
  border-radius: 1px;
}

.hero-compact-profit {
  font-weight: 700;
  color: var(--warning);
  font-size: 1rem;
  margin-left: auto;
}


/* Tab Navigation */
.tab-navigation-wrapper {
  position: relative;
}

@media (max-width: 767px) {
  .tab-navigation-wrapper::before,
  .tab-navigation-wrapper::after {
    content: '';
    position: absolute;
    top: 0;
    height: calc(100% - 1.5rem);
    width: 2rem;
    pointer-events: none;
    z-index: 2;
  }

  .tab-navigation-wrapper::before {
    left: 0;
    background: linear-gradient(to left, transparent, var(--bg-primary) 85%);
  }

  .tab-navigation-wrapper::after {
    right: 0;
    background: linear-gradient(to right, transparent, var(--bg-primary) 85%);
  }
}

.tab-navigation {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-color);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--border-color) transparent;
}

.tab-navigation::-webkit-scrollbar {
  height: 4px;
}

.tab-navigation::-webkit-scrollbar-track {
  background: transparent;
}

.tab-navigation::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 2px;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  white-space: nowrap;
  flex-shrink: 0;
  position: relative;
}

.tab-button::before {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background-color: var(--accent-primary);
  transform: translateX(-50%);
  transition: width 0.2s ease-in-out;
}

.tab-button:hover {
  color: var(--text-primary);
  background-color: rgba(255, 255, 255, 0.03);
}

.tab-button:hover::before {
  width: 80%;
}

.tab-button.active {
  color: var(--accent-primary);
  border-bottom-color: var(--accent-primary);
  background-color: rgba(59, 130, 246, 0.05);
}

.tab-button.active::before {
  width: 100%;
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  margin-left: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  background-color: rgba(59, 130, 246, 0.2);
  color: var(--accent-primary);
  border: 1px solid rgba(59, 130, 246, 0.4);
  border-radius: 0.75rem;
}

.tab-label-short {
  display: none;
}

.tab-label-full {
  display: inline;
}

/* Tab Content */
.tab-content {
  min-height: 400px;
}

.content-placeholder {
  background-color: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.5rem;
  padding: 3rem;
  text-align: center;
}

.content-placeholder h3 {
  font-size: 1.5rem;
  margin-bottom: 1rem;
  color: var(--text-primary);
}

.content-placeholder p {
  color: var(--text-secondary);
  font-size: 1rem;
  margin-bottom: 0.5rem;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
  /* Performance: GPU acceleration for modal overlay */
  will-change: opacity;
  /* Contain paint operations */
  contain: layout style paint;
}

.modal-content {
  background-color: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 0.75rem;
  max-width: 800px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  /* Performance: GPU acceleration for smooth animations */
  will-change: transform, opacity;
  /* Contain layout and paint */
  contain: layout style paint;
}

.modal-header {
  position: sticky;
  top: 0;
  background-color: var(--bg-primary);
  padding: 1rem;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
  z-index: 10;
}

.btn-close {
  padding: 0.5rem;
  background-color: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 44px;
  min-height: 44px;
}

.btn-close:hover {
  background-color: rgba(239, 68, 68, 0.1);
  color: var(--danger);
  border-color: var(--danger);
  box-shadow: 0 2px 8px rgba(239, 68, 68, 0.3);
}

.btn-close:active {
  transform: scale(0.95);
  box-shadow: 0 1px 4px rgba(239, 68, 68, 0.2);
}

/* Charts Section */
.charts-section {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.charts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 1.5rem;
  align-items: stretch;
}

.charts-grid > * {
  display: flex;
  flex-direction: column;
}

@media (max-width: 1024px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
}

/* Tablet Responsive (768px to 1023px) */
@media (min-width: 768px) and (max-width: 1023px) {
  .app-header {
    padding: 1rem 1.5rem;
  }

  .app-main {
    padding: 1.5rem;
  }

  .hero-section {
    padding: 1.75rem;
  }

  .hero-name {
    font-size: 1.75rem;
  }

  .hero-profit-value {
    font-size: 2.5rem;
  }

  .tab-button {
    min-height: 44px;
  }
}

/* Mobile Responsive (<768px) */
@media (max-width: 767px) {
  .app-header {
    padding: 0.375rem 0.75rem;
  }

  .header-content {
    flex-direction: row;
    gap: 0.5rem;
    align-items: center;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-left: auto;
  }

  .app-title {
    font-size: 0.875rem;
  }

  .last-update {
    font-size: 0.75rem;
  }

  .btn-settings {
    min-width: 44px;
    min-height: 44px;
    padding: 0.5rem;
  }

  .app-main {
    padding: 0.5rem;
  }

  .hero-section {
    padding: 0.625rem;
    margin-bottom: 0.375rem;
  }

  .hero-content {
    gap: 0.375rem;
  }

  .hero-label {
    font-size: 0.6875rem;
  }

  .hero-name {
    font-size: 1rem;
  }

  .hero-badge {
    padding: 0.1875rem 0.375rem;
    font-size: 0.6875rem;
  }

  .hero-profit-value {
    font-size: 1.25rem;
  }

  .hero-profit-label {
    font-size: 0.875rem;
  }

  .hero-details {
    display: none;
  }

  /* At 375px, compress hero to 2 tight lines */
  @media (max-width: 375px) {
    .hero-section {
      padding: 0.375rem 0.5rem;
      margin-bottom: 0.25rem;
    }

    .hero-content {
      gap: 0.125rem;
    }

    .hero-label {
      font-size: 0.5625rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .hero-name {
      font-size: 0.9375rem;
    }

    .hero-profit-value {
      font-size: 1.125rem;
    }

    .hero-profit-label {
      font-size: 0.75rem;
    }
  }

  .hero-compact {
    flex-wrap: wrap;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    margin-bottom: 0.5rem;
    min-height: 40px;
  }

  .hero-compact-label {
    font-size: 0.6875rem;
  }

  .hero-compact-name {
    font-size: 0.875rem;
  }

  .hero-compact-badge {
    padding: 0.1875rem 0.375rem;
    font-size: 0.6875rem;
  }

  .hero-compact-separator {
    display: none;
  }

  .hero-compact-profit {
    font-size: 0.9375rem;
    width: 100%;
    margin-left: 0;
    margin-top: 0.25rem;
    text-align: left;
  }


  .tab-navigation {
    margin-bottom: 0.5rem;
    scroll-snap-type: x mandatory;
    scroll-padding-inline: 0.5rem;
    gap: 0.125rem;
  }

  .tab-button {
    scroll-snap-align: start;
    min-height: 44px;
    padding: 0.625rem 0.5rem;
    font-size: 0.8125rem;
  }

  .tab-label-full {
    display: none;
  }

  .tab-label-short {
    display: inline;
  }

  .modal-overlay {
    padding: 0;
    align-items: flex-end;
    background-color: rgba(0, 0, 0, 0.85);
  }

  .modal-content {
    max-height: 92vh;
    border-radius: 1.25rem 1.25rem 0 0;
    width: 100%;
    max-width: 100%;
    animation: slideUp 0.3s ease-out;
  }

  @keyframes slideUp {
    from {
      transform: translateY(100%);
    }
    to {
      transform: translateY(0);
    }
  }

  .modal-header {
    padding: 1rem 1.25rem;
  }

  .modal-header::before {
    content: '';
    position: absolute;
    top: 0.5rem;
    left: 50%;
    transform: translateX(-50%);
    width: 2.5rem;
    height: 0.25rem;
    background-color: var(--border-color);
    border-radius: 0.125rem;
  }

  .btn-close {
    min-width: 48px;
    min-height: 48px;
    padding: 0.75rem;
  }
}

/* Small mobile (<480px) */
@media (max-width: 479px) {
  .app-title {
    font-size: 1rem;
  }

  .hero-name {
    font-size: 1.25rem;
  }

  .hero-profit-value {
    font-size: 1.5rem;
  }
}
</style>
