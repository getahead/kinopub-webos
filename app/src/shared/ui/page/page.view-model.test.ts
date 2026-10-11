import { describe, expect, it } from 'vitest'
import { PageViewModel } from './page.view-model'

function page(stackHeight: number, viewport = 1080) {
  const vm = new PageViewModel(120, 0, viewport, false)
  const stack = { offsetHeight: stackHeight } as HTMLElement

  vm.setStack(stack)

  return vm
}

describe('PageViewModel.reveal', () => {
  it('does not scroll for focus taken by the pointer', () => {
    let pointer = false
    const vm = new PageViewModel(120, 0, 1080, false, () => pointer)
    const stack = { offsetHeight: 5000 } as HTMLElement
    const row = { offsetTop: 2000, offsetHeight: 400, offsetParent: stack } as unknown as HTMLElement

    vm.setStack(stack)
    pointer = true
    vm.reveal(row)
    expect(vm.offset).toBe(0)
    pointer = false
    vm.reveal(row)
    expect(vm.offset).toBeGreaterThan(0)
  })
})

describe('PageViewModel.scrollBy', () => {
  it('moves one fixed step per wheel notch regardless of the delta size', () => {
    const vm = page(5000)

    vm.scrollBy(100)
    expect(vm.offset).toBe(240)
    vm.scrollBy(1)
    expect(vm.offset).toBe(480)
    vm.scrollBy(-3000)
    expect(vm.offset).toBe(240)
  })

  it('stays within the content and ignores zero deltas', () => {
    const vm = page(1500)

    vm.scrollBy(-100)
    expect(vm.offset).toBe(0)
    vm.scrollBy(100)
    vm.scrollBy(100)
    vm.scrollBy(100)
    expect(vm.offset).toBe(1500 + 60 - 1080)
    vm.scrollBy(0)
    expect(vm.offset).toBe(1500 + 60 - 1080)
  })

  it('does nothing for content that fits or without a stack', () => {
    expect(() => new PageViewModel(120, 0, 1080, false).scrollBy(100)).not.toThrow()
    const vm = page(800)

    vm.scrollBy(100)
    expect(vm.offset).toBe(0)
  })
})
