<script setup lang="ts">
const props = defineProps<{
  modelValue: boolean
  count: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
}>()

const handleChange = () => {
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <label v-if="count > 0" class="low-confidence-toggle">
    <span class="toggle-switch">
      <input
        type="checkbox"
        :checked="modelValue"
        aria-label="Show low-confidence items"
        @change="handleChange"
      />
      <span class="toggle-slider"></span>
    </span>
    <span class="toggle-label">
      <span class="toggle-label-full">Show low-confidence</span>
      <span class="toggle-label-short">Low-conf.</span>
      <span class="toggle-count">({{ count }})</span>
    </span>
  </label>
</template>

<style scoped>
/* Low-confidence toggle */
.low-confidence-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
}

/* Toggle switch container */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
  flex-shrink: 0;
}

/* Hide the default checkbox */
.toggle-switch input[type="checkbox"] {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

/* The slider */
.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  transition: all 0.3s var(--ease-out);
}

/* The slider knob */
.toggle-slider::before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: var(--text-secondary);
  border-radius: 50%;
  transition: all 0.3s var(--ease-out);
}

/* Hover state */
.low-confidence-toggle:hover .toggle-slider {
  border-color: var(--warning);
}

/* Focus state for accessibility */
.toggle-switch input[type="checkbox"]:focus + .toggle-slider {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
}

/* Checked state */
.toggle-switch input[type="checkbox"]:checked + .toggle-slider {
  background-color: rgba(245, 158, 11, 0.2);
  border-color: var(--warning);
}

.toggle-switch input[type="checkbox"]:checked + .toggle-slider::before {
  background-color: var(--warning);
  transform: translateX(16px);
}

.low-confidence-toggle .toggle-label {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.low-confidence-toggle .toggle-label-short {
  display: none;
}

.low-confidence-toggle .toggle-count {
  font-size: 0.75rem;
  opacity: 0.8;
}

.low-confidence-toggle:hover {
  color: var(--text-primary);
}

@media (max-width: 767px) {
  .low-confidence-toggle {
    font-size: 0.75rem;
    padding: 0.25rem 0;
    gap: 0.375rem;
  }

  .toggle-switch {
    width: 32px;
    height: 18px;
  }

  .toggle-slider::before {
    height: 12px;
    width: 12px;
  }

  .toggle-switch input[type="checkbox"]:checked + .toggle-slider::before {
    transform: translateX(14px);
  }

  .toggle-label-full {
    display: none;
  }

  .toggle-label-short {
    display: inline;
  }
}
</style>
