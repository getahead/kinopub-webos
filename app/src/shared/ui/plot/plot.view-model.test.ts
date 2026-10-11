import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PlotViewModel } from './plot.view-model'

class FakeResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}

function node(scrollHeight: number, clientHeight: number) {
  return { scrollHeight, clientHeight } as HTMLElement
}

describe('PlotViewModel', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
  })

  it('marks the plot truncated only when the text overflows its box', () => {
    const vm = new PlotViewModel()

    vm.setNode(node(300, 120))
    expect(vm.truncated).toBe(true)
    vm.setNode(node(120, 120))
    expect(vm.truncated).toBe(false)
    vm.dispose()
  })

  it('opens the dialog on press whether or not the text is truncated', () => {
    const vm = new PlotViewModel()

    vm.setNode(node(120, 120))
    vm.show()
    expect(vm.open).toBe(true)
    vm.hide()
    expect(vm.open).toBe(false)
    vm.dispose()
  })
})
