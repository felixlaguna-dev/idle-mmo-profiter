<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  modelValue: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void
}>()

// Local input value to handle editing
const inputValue = ref(props.modelValue.toString())

// Watch for external changes to modelValue
watch(
  () => props.modelValue,
  (newValue) => {
    inputValue.value = newValue.toString()
  }
)

// Handle input changes - emit on blur or enter key
const handleBlur = () => {
  const parsed = parseInt(inputValue.value, 10)
  if (!isNaN(parsed) && parsed >= 0) {
    emit('update:modelValue', parsed)
  } else {
    // Reset to current valid value if input is invalid
    inputValue.value = props.modelValue.toString()
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleBlur()
    ;(event.target as HTMLInputElement).blur()
  }
}
</script>

<template>
  <label class="min-sales-threshold">
    <span class="threshold-label">
      <span class="threshold-label-full">Min sales/wk:</span>
      <span class="threshold-label-short">Min/wk:</span>
    </span>
    <input
      v-model="inputValue"
      type="number"
      min="0"
      step="1"
      class="threshold-input"
      aria-label="Minimum weekly sales threshold"
      @blur="handleBlur"
      @keydown="handleKeydown"
    />
  </label>
</template>

<style scoped>
/* Min sales threshold input */
.min-sales-threshold {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-secondary);
  user-select: none;
  white-space: nowrap;
}

.threshold-label {
  display: flex;
  align-items: center;
}

.threshold-label-short {
  display: none;
}

/* Numeric input */
.threshold-input {
  width: 60px;
  padding: 0.25rem 0.5rem;
  font-size: 0.8125rem;
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 4px;
  transition: all 0.3s var(--ease-out);
  text-align: right;
}

/* Remove spin arrows */
.threshold-input::-webkit-outer-spin-button,
.threshold-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.threshold-input[type='number'] {
  -moz-appearance: textfield;
}

/* Focus state */
.threshold-input:focus {
  outline: 2px solid var(--accent-primary);
  outline-offset: 2px;
  background-color: var(--bg-secondary);
}

/* Hover state */
.min-sales-threshold:hover .threshold-input {
  border-color: var(--accent-primary);
}

.min-sales-threshold:hover {
  color: var(--text-primary);
}

@media (max-width: 767px) {
  .min-sales-threshold {
    font-size: 0.75rem;
    padding: 0.25rem 0;
    gap: 0.375rem;
  }

  .threshold-input {
    width: 50px;
    font-size: 0.75rem;
    padding: 0.2rem 0.4rem;
  }

  .threshold-label-full {
    display: none;
  }

  .threshold-label-short {
    display: inline;
  }
}
</style>
