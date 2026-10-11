import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ImageService } from '@/services/images/image.service'
import { RowViewModel } from './row.view-model'

function row(count = 20, pointer = () => false) {
  return new RowViewModel({
    count,
    width: 232,
    initialOffset: 0,
    saveOffset: vi.fn(),
    images: { prefetch: vi.fn() } as unknown as ImageService,
    pointer,
  })
}

describe('RowViewModel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  it('scrolls to the focused card for key navigation but not for pointer focus', () => {
    let pointer = false
    const vm = row(20, () => pointer)

    vm.focusItem(5)
    expect(vm.offset).toBe(5 * 260)
    pointer = true
    vm.focusItem(9)
    expect(vm.offset).toBe(5 * 260)
    vm.dispose()
  })

  it('edge zones move one card per interval and stop at both ends', () => {
    const vm = row(3)

    vm.edgeHover(1)
    vm.edgeHover(1)
    expect(vm.offset).toBe(Math.min(260, vm.maxOffset))
    vi.advanceTimersByTime(360)
    vm.edgeHover(1)
    vm.edgeHover(1)
    expect(vm.offset).toBe(vm.maxOffset)
    vi.advanceTimersByTime(360)
    vm.edgeHover(-1)
    vi.advanceTimersByTime(360)
    vm.edgeHover(-1)
    vi.advanceTimersByTime(360)
    vm.edgeHover(-1)
    expect(vm.offset).toBe(0)
    vm.dispose()
  })
})
