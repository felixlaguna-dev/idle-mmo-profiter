import { ref } from 'vue'

/**
 * Composable for managing popover state.
 * Stores raw cursor coordinates for positioning.
 */
export function usePopover() {
  const popoverItemName = ref<string | null>(null)
  const popoverX = ref(0)
  const popoverY = ref(0)

  const openItemUses = (event: MouseEvent, itemName: string) => {
    event.preventDefault()
    event.stopPropagation()
    // Store cursor viewport coordinates for position: fixed
    popoverX.value = event.clientX
    popoverY.value = event.clientY
    popoverItemName.value = itemName
  }

  const closeItemUses = () => {
    popoverItemName.value = null
  }

  return {
    popoverItemName,
    popoverX,
    popoverY,
    openItemUses,
    closeItemUses,
  }
}
