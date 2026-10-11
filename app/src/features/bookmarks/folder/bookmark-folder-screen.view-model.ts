import { makeAutoObservable } from 'mobx'
import { InfiniteQuery, Mutation } from 'mobx-tanstack-query'
import type { BookmarkFolder, ItemShort, Pagination } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { Scope } from '@/shared/view-model/use-view-model'
import { nextPage } from '@/services/query/next-page'

type FolderPage = { folder: BookmarkFolder; items: ItemShort[]; pagination: Pagination }

export class BookmarkFolderScreenViewModel {
  private readonly scope = new Scope()
  readonly pages: InfiniteQuery<FolderPage, Error, number>
  readonly remove: Mutation<unknown, void>
  /** Deleting a folder with items asks first; an empty one goes straight away. */
  confirmOpen = false

  constructor(
    { api, queryClient, ui, router }: Services,
    readonly id: number,
  ) {
    this.pages = new InfiniteQuery<FolderPage, Error, number>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['bookmarks', 'folder', id],
      queryFn: ({ signal, pageParam }) => api.bookmarkFolderItems(id, pageParam, signal),
      initialPageParam: 1,
      getNextPageParam: nextPage,
      staleTime: 0,
    })
    this.remove = new Mutation<unknown, void>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: () => api.removeBookmarkFolder(id),
      onSuccess: () => {
        ui.showToast(`Папка «${this.title ?? ''}» удалена`)
        void queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
        router.back()
      },
      onError: (error) => ui.showToast(error.message),
    })
    makeAutoObservable<this, 'scope' | 'services'>(
      this,
      { scope: false, services: false, id: false, pages: false, remove: false },
      { autoBind: true },
    )
  }

  get folder() {
    return this.pages.data?.pages[0]?.folder
  }

  get title() {
    return this.pages.data?.pages[0]?.folder.title
  }

  get list(): ItemShort[] {
    return this.pages.data?.pages.flatMap((p) => p.items) ?? []
  }

  askRemove() {
    if ((this.folder?.count ?? this.list.length) > 0) this.confirmOpen = true
    else this.confirmRemove()
  }

  cancelRemove() {
    this.confirmOpen = false
  }

  confirmRemove() {
    this.confirmOpen = false
    this.remove.mutate().catch(() => {}) // onError already reports it
  }

  loadMore() {
    if (this.pages.hasNextPage && !this.pages.isFetchingNextPage) void this.pages.fetchNextPage()
  }

  dispose() {
    this.scope.dispose()
  }
}
