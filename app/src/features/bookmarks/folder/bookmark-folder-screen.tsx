import { observer } from 'mobx-react-lite'
import { useLocation, useParams } from 'react-router'
import { plural } from '@/shared/lib/format'
import { Button } from '@/shared/ui/button'
import { FocusGroup } from '@/shared/ui/focus'
import { Grid } from '@/shared/ui/grid'
import { IconTrash } from '@/shared/ui/icons'
import { Sheet, SheetOption } from '@/shared/ui/sheet'
import { Page } from '@/shared/ui/page'
import { Status } from '@/shared/ui/status'
import { useViewModel } from '@/shared/view-model/use-view-model'
import { BookmarkFolderScreenViewModel } from './bookmark-folder-screen.view-model'
import { Empty } from '@/shared/ui/empty'
import styles from './bookmark-folder-screen.module.css'

export const BookmarkFolderScreen = observer(function BookmarkFolderScreen() {
  const { id = '0' } = useParams()
  const location = useLocation()
  const vm = useViewModel((services) => new BookmarkFolderScreenViewModel(services, Number(id)))
  const title = vm.title ?? (location.state as { title?: string } | null)?.title ?? 'Закладки'

  return (
    <Page hero title={title} focusKey={`PAGE-bm-${id}`} initialFocusKey="GRID-bm-0" ready={!vm.pages.isLoading}>
      <Status loading={vm.pages.isLoading} error={vm.pages.error?.message} onRetry={() => vm.pages.refetch()} />
      {vm.pages.isSuccess && (
        <FocusGroup reveal focusKey="BM-folder-actions" className={styles.actions}>
          <Button size="sm" focusKey="BM-remove" icon={<IconTrash />} onPress={vm.askRemove}>
            Удалить папку
          </Button>
        </FocusGroup>
      )}
      {vm.pages.isSuccess && vm.list.length === 0 && <Empty>Папка пуста.</Empty>}
      <Grid items={vm.list} focusKey="GRID-bm" loading={vm.pages.isFetchingNextPage} onReachEnd={vm.loadMore} />
      {vm.confirmOpen && (
        <Sheet title={`Удалить папку «${title}»?`} onClose={vm.cancelRemove} initialFocusKey="BM-confirm-cancel" returnFocusKey="BM-remove">
          <p className={styles.confirmHint}>
            В ней {vm.list.length} {plural(vm.list.length, 'запись', 'записи', 'записей')}. Сами фильмы останутся в каталоге.
          </p>
          <SheetOption focusKey="BM-confirm-cancel" onPress={vm.cancelRemove}>
            Отмена
          </SheetOption>
          <SheetOption focusKey="BM-confirm-remove" onPress={vm.confirmRemove}>
            Удалить
          </SheetOption>
        </Sheet>
      )}
    </Page>
  )
})
