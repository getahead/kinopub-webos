import { makeAutoObservable, reaction } from 'mobx'
import { Mutation, Query } from 'mobx-tanstack-query'
import type { BookmarkFolder, Item, ItemShort, Video } from '@/services/api/api.types'
import type { Services } from '@/services/services'
import { episodeLabel, formatDuration, splitTitle, widePosterUrl } from '@/shared/lib/format'
import { Scope } from '@/shared/view-model/use-view-model'
import { link } from '@/app/routes'
import { itemQueryKey } from '@/services/query/item-query-key'
import { resumePoint } from '@/shared/lib/resume-point'
import { findPhoto, type PersonPhoto } from '@/services/people-photos/people-photos.service'
import type { PersonEntry } from './people/people'

/** Credits can list nearly a hundred actors; only the leading ones fit on screen. */
const PEOPLE_CAST_LIMIT = 15
const PHOTOS_CACHE_MS = 60 * 60 * 1000

export interface PlayTarget {
  video: Video
  season: number
  resumeFrom: number
}

export class ItemScreenViewModel {
  private readonly scope = new Scope()
  readonly item: Query<Item>
  readonly similar: Query<ItemShort[]>
  readonly photos: Query<PersonPhoto[], Error, PersonPhoto[], PersonPhoto[], [string, number | undefined]>
  readonly folders: Query<BookmarkFolder[]>
  readonly itemFolders: Query<BookmarkFolder[]>
  readonly toggleBookmark: Mutation<unknown, BookmarkFolder>
  readonly toggleWatchlist: Mutation<{ watching: boolean }, void>
  readonly toggleWatched: Mutation<unknown, { video: number; season?: number }>
  readonly clearHistory: Mutation<unknown, void>
  readonly createFolder: Mutation<BookmarkFolder, string>

  seasonIndex = 0
  bookmarksOpen = false
  /** The «new folder» field inside the bookmarks sheet. */
  newFolderOpen = false

  constructor(
    private readonly services: Services,
    readonly id: number,
    readonly preview?: ItemShort,
  ) {
    const { api, queryClient, ui, peoplePhotos } = services

    makeAutoObservable<this, 'scope' | 'services'>(
      this,
      {
        scope: false,
        services: false,
        id: false,
        preview: false,
        item: false,
        similar: false,
        photos: false,
        folders: false,
        itemFolders: false,
        toggleBookmark: false,
        toggleWatchlist: false,
        toggleWatched: false,
        clearHistory: false,
        createFolder: false,
      },
      { autoBind: true },
    )

    ui.setBackdrop(widePosterUrl(id, preview?.posters))

    this.item = new Query<Item>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: itemQueryKey(id),
      queryFn: ({ signal }) => api.item(id, signal),
      staleTime: 0,
      onDone: (item) => this.selectSeasonForNext(item),
    })
    // After `item` exists: `data` reads it, and a computed that threw once stays thrown while observed.
    this.scope.defer(reaction(() => this.data?.trailer?.url ?? '', ui.setTrailer, { fireImmediately: true }))
    this.scope.defer(ui.clearTrailer)

    this.similar = new Query<ItemShort[]>({
      queryClient,
      abortSignal: this.scope.signal,
      queryKey: ['similar', id],
      queryFn: ({ signal }) => api.similar(id, signal),
    })

    // Photos are extra: they load after the page, and the cards show initials until then or on failure.
    this.photos = new Query({
      queryClient,
      abortSignal: this.scope.signal,
      queryFn: ({ signal, queryKey: [, imdb] }) => peoplePhotos.byImdb(imdb!, signal),
      options: () => ({ queryKey: ['people-photos', this.data?.imdb], enabled: !!this.data?.imdb }),
      staleTime: Infinity,
      gcTime: PHOTOS_CACHE_MS,
      retry: 1,
    })

    // enableOnDemand defers the bookmark folders request until first read (the sheet is opened).
    this.folders = new Query<BookmarkFolder[]>({
      queryClient,
      abortSignal: this.scope.signal,
      enableOnDemand: true,
      queryKey: ['bookmarks'],
      queryFn: ({ signal }) => api.bookmarkFolders(signal),
    })

    this.itemFolders = new Query<BookmarkFolder[]>({
      queryClient,
      abortSignal: this.scope.signal,
      enableOnDemand: true,
      queryKey: ['bookmarks', 'item', id],
      queryFn: ({ signal }) => api.itemBookmarkFolders(id, signal),
      staleTime: 0,
    })

    this.toggleBookmark = new Mutation<unknown, BookmarkFolder>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: (folder) => api.toggleBookmark(id, folder.id),
      onSuccess: (_, folder) => {
        const wasIn = this.isInFolder(folder.id)

        ui.showToast(wasIn ? `Убрано из «${folder.title}»` : `Добавлено в «${folder.title}»`)
        void this.itemFolders.invalidate()
        void queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      },
      onError: (error) => ui.showToast(error.message),
    })

    this.toggleWatchlist = new Mutation<{ watching: boolean }, void>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: () => api.toggleWatchlist(id),
      onSuccess: (result) => {
        ui.showToast(result.watching ? 'Сериал в списке «Я смотрю»' : 'Сериал убран из «Я смотрю»')
        this.item.setData((item) => item && { ...item, in_watchlist: result.watching })
        void queryClient.invalidateQueries({ queryKey: ['home', 'continue'] })
        void queryClient.invalidateQueries({ queryKey: ['watching'] })
      },
      onError: (error) => ui.showToast(error.message),
    })

    this.toggleWatched = new Mutation<unknown, { video: number; season?: number }>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: ({ video, season }) => api.toggleWatched(id, video, season),
      onSuccess: () => {
        ui.showToast('Отметка просмотра изменена')
        void this.item.refetch()
      },
      onError: (error) => ui.showToast(error.message),
    })

    this.createFolder = new Mutation<BookmarkFolder, string>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: (title) => api.createBookmarkFolder(title),
      onSuccess: (folder) => {
        this.newFolderOpen = false
        this.folders.setData((folders) => [...(folders ?? []), folder])
        void queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
        // The viewer came here to file this item: a fresh folder with it inside saves the second step.
        this.toggleBookmark.mutate(folder).catch(() => {})
      },
      onError: (error) => ui.showToast(error.message),
    })

    this.clearHistory = new Mutation<unknown, void>({
      queryClient,
      abortSignal: this.scope.signal,
      mutationFn: () => api.clearHistory(id),
      onSuccess: () => {
        ui.showToast('Убрано из «Я смотрю»')
        void this.item.refetch()
        void queryClient.invalidateQueries({ queryKey: ['watching'] })
        void queryClient.invalidateQueries({ queryKey: ['home', 'continue'] })
        void queryClient.invalidateQueries({ queryKey: ['history'] })
      },
      onError: (error) => ui.showToast(error.message),
    })
  }

  get data(): Item | undefined {
    return this.item.data
  }

  get title() {
    return splitTitle(this.data?.title ?? this.preview?.title ?? '')
  }

  get isSerial() {
    return (this.data?.seasons?.length ?? 0) > 0
  }

  get seasons() {
    return this.data?.seasons ?? []
  }

  get currentSeason() {
    return this.seasons[this.seasonIndex]
  }

  get episodes(): { videos: Video[]; season: number } | null {
    if (this.isSerial) return this.currentSeason ? { videos: this.currentSeason.episodes, season: this.currentSeason.number } : null

    const videos = this.data?.videos ?? []

    return videos.length > 1 ? { videos, season: 0 } : null
  }

  get next(): PlayTarget | null {
    const item = this.data

    if (!item) return null
    if (item.seasons?.length) {
      for (const season of item.seasons) {
        for (const episode of season.episodes)
          if (episode.watched !== 1) return { video: episode, season: season.number, resumeFrom: resumePoint(episode) }
      }

      const last = item.seasons[item.seasons.length - 1]
      const video = last.episodes[last.episodes.length - 1]

      return { video, season: last.number, resumeFrom: 0 }
    }

    const video = item.videos?.find((v) => v.watched !== 1) ?? item.videos?.[0]

    return video ? { video, season: 0, resumeFrom: resumePoint(video) } : null
  }

  get playLabel(): string {
    const next = this.next

    if (!next) return 'Смотреть'

    const verb = next.resumeFrom > 0 ? 'Продолжить' : 'Смотреть'

    if (this.isSerial) return `${verb} ${episodeLabel(next.season, next.video.number)}`

    return next.resumeFrom > 0 ? `Продолжить с ${formatDuration(next.resumeFrom)}` : 'Смотреть'
  }

  get metaLine(): string[] {
    const item = this.data

    if (!item) return []

    const parts: string[] = []

    if (item.countries?.length) parts.push(item.countries.map((c) => c.title).join(', '))
    if (item.genres?.length) parts.push(item.genres.map((g) => g.title).join(', '))

    const duration = item.duration?.average ?? 0

    if (duration > 0) parts.push(this.isSerial ? `серия ${formatDuration(duration)}` : formatDuration(duration))

    return parts
  }

  get people(): PersonEntry[] {
    const item = this.data

    if (!item) return []

    const photos = this.photos.data ?? []
    const directors = splitNames(item.director).map((name) => ({ role: 'director' as const, name, photo: findPhoto(name, photos) }))
    const cast = splitNames(item.cast)
      .slice(0, PEOPLE_CAST_LIMIT)
      .map((name) => ({ role: 'cast' as const, name, photo: findPhoto(name, photos) }))

    return [...directors, ...cast]
  }

  get movieWatched() {
    return !this.isSerial && this.data?.videos?.[0]?.watched === 1
  }

  /** A movie started and not finished: the state that lists it under «Я смотрю». */
  get movieInProgress() {
    const video = this.data?.videos?.[0]

    return !this.isSerial && !!video && video.watched !== 1 && (video.watching?.time ?? 0) > 0
  }

  get inFolders(): number[] {
    return (this.itemFolders.data ?? []).map((f) => f.id)
  }

  isInFolder(folderId: number) {
    return this.inFolders.includes(folderId)
  }

  /** Stable handler for episode cards: a per-render closure would re-render every card on any screen change. */
  playEpisode(video: Video, season: number) {
    this.play({ video, season, resumeFrom: video.watched !== 1 ? (video.watching?.time ?? 0) : 0 })
  }

  play(target: PlayTarget, fromStart = false) {
    const { router } = this.services

    void router.navigate(link.player(this.id, target.video.id, { t: fromStart ? 0 : target.resumeFrom }))
  }

  playTrailer() {
    const url = this.data?.trailer?.url

    if (!url) return

    void this.services.router.navigate(link.player(this.id, 0), { state: { trailer: url } })
  }

  selectSeason(index: number) {
    this.seasonIndex = index
  }

  openBookmarks() {
    this.bookmarksOpen = true
  }

  closeBookmarks() {
    this.bookmarksOpen = false
    this.newFolderOpen = false
  }

  openNewFolder() {
    this.newFolderOpen = true
  }

  submitNewFolder(title: string) {
    this.createFolder.mutate(title).catch(() => {}) // onError already reports it
  }

  removeFromWatching() {
    this.clearHistory.mutate().catch(() => {}) // onError already reports it
  }

  markMovieWatched() {
    const video = this.data?.videos?.[0]

    // Failures reach the viewer through onError; the rejected promise itself would only be an unhandled rejection.
    if (video) this.toggleWatched.mutate({ video: video.number }).catch(() => {})
  }

  dispose() {
    this.scope.dispose()
  }

  private selectSeasonForNext(item: Item) {
    const next = this.next

    if (!next || !item.seasons) return

    const index = item.seasons.findIndex((s) => s.number === next.season)

    if (index >= 0) this.seasonIndex = index
  }
}

/** Views of a minute or less don't count as a resume point. */
function splitNames(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
}
