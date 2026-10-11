import { makeAutoObservable, reaction } from 'mobx'
import type { ImageService } from '@/services/images/image.service'
import { VirtualList } from '@/shared/lib/virtual-list'
import { CARD_GAP, ROW_END_GUTTER, ROW_VIEWPORT } from '@/shared/ui/card'
import { GlideDetector } from '@/shared/ui/motion'

export interface RowParams {
  count: number
  width: number
  initialOffset: number
  saveOffset: (offset: number) => void
  images: ImageService
  imageOf?: (index: number) => string | undefined
  /** Focus taken by the Magic Remote pointer must not scroll; the edge zones scroll instead. */
  pointer?: () => boolean
}

const IMAGE_AHEAD = 4
/** Resting the pointer on an edge zone moves the row one card per this interval. */
const EDGE_INTERVAL_MS = 360

export class RowViewModel {
  offset: number
  count: number
  readonly list: VirtualList
  root: HTMLDivElement | null = null
  /** True while an arrow is held: the track then moves linearly, in step with key repeats. */
  gliding = false
  private readonly glide = new GlideDetector()
  private readonly step: number
  private readonly saveOffset: (offset: number) => void
  private readonly stopPrefetch: () => void
  private readonly pointer: () => boolean
  private edgeTimer: number | null = null

  constructor({ count, width, initialOffset, saveOffset, images, imageOf, pointer = () => false }: RowParams) {
    this.count = count
    this.saveOffset = saveOffset
    this.pointer = pointer
    this.step = width + CARD_GAP
    this.offset = initialOffset
    makeAutoObservable<this, 'step' | 'saveOffset' | 'stopPrefetch' | 'glide' | 'pointer' | 'edgeTimer'>(
      this,
      { list: false, root: false, step: false, saveOffset: false, stopPrefetch: false, glide: false, pointer: false, edgeTimer: false },
      { autoBind: true },
    )
    this.list = new VirtualList({
      count: () => this.count,
      step: this.step,
      viewport: ROW_VIEWPORT,
      offset: () => this.offset,
      horizontal: true,
      overscan: 3,
    })
    this.stopPrefetch = reaction(
      () => [this.list.lastIndex, this.count] as const,
      ([last, total]) => {
        if (!imageOf) return

        const urls: string[] = []

        for (let index = last + 1; index < Math.min(total, last + 1 + IMAGE_AHEAD); index++) {
          const url = imageOf(index)

          if (url) urls.push(url)
        }

        images.prefetch(urls)
      },
      { fireImmediately: true },
    )
  }

  get maxOffset() {
    return Math.max(0, this.count * this.step - CARD_GAP - ROW_VIEWPORT + ROW_END_GUTTER)
  }

  get firstVisible() {
    return Math.min(Math.ceil(this.offset / this.step), Math.max(0, this.count - 1))
  }

  setRoot(el: HTMLDivElement | null) {
    this.root = el
  }

  setCount(count: number) {
    this.count = count
  }

  focusItem(index: number) {
    if (this.pointer()) return

    const next = Math.min(index * this.step, this.maxOffset)

    if (next === this.offset) return

    this.gliding = this.glide.step()
    this.offset = next
  }

  /** One card in the given direction, without the glide easing of held keys. */
  scrollStep(direction: -1 | 1) {
    const next = Math.max(0, Math.min(this.maxOffset, this.offset + direction * this.step))

    if (next === this.offset) return

    this.gliding = false
    this.offset = next
  }

  /** Pointer resting on an edge zone: step now, then not again until the interval has passed. */
  edgeHover(direction: -1 | 1) {
    if (this.edgeTimer) return

    this.scrollStep(direction)
    this.edgeTimer = window.setTimeout(() => {
      this.edgeTimer = null
    }, EDGE_INTERVAL_MS)
  }

  dispose() {
    if (this.edgeTimer) clearTimeout(this.edgeTimer)

    this.stopPrefetch()
    this.saveOffset(this.offset)
    this.list.dispose()
    this.root = null
  }
}
