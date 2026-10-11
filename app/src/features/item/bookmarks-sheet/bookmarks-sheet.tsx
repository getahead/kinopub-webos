import { setFocus } from '@noriginmedia/norigin-spatial-navigation'
import { observer } from 'mobx-react-lite'
import { useEffect } from 'react'
import { Button } from '@/shared/ui/button'
import { IconPlus } from '@/shared/ui/icons'
import { Sheet, SheetOption } from '@/shared/ui/sheet'
import { Spinner } from '@/shared/ui/spinner'
import { TextInput } from '@/shared/ui/text-input'
import type { ItemScreenViewModel } from '../item-screen.view-model'
import styles from './bookmarks-sheet.module.css'

export const BookmarksSheet = observer(function BookmarksSheet({ vm }: { vm: ItemScreenViewModel }) {
  const folders = vm.folders.data ?? []

  useEffect(() => {
    if (vm.folders.isLoading) return

    setFocus(folders.length ? 'SHEET-folder-0' : 'SHEET-new-folder')
  }, [folders.length, vm.folders.isLoading])

  return (
    <Sheet title="Закладки" onClose={vm.closeBookmarks}>
      {vm.folders.isLoading && <Spinner />}
      {/* First, and styled as an action rather than a folder: a dashed row with a plus, which the name field replaces. */}
      {!vm.folders.isLoading &&
        (vm.newFolderOpen ? (
          <TextInput focusKey="SHEET-new-folder" placeholder="Название папки" onSubmit={vm.submitNewFolder} autoFocus />
        ) : (
          <Button variant="list" className={styles.newFolder} focusKey="SHEET-new-folder" icon={<IconPlus />} onPress={vm.openNewFolder}>
            Новая папка
          </Button>
        ))}
      {folders.map((folder, index) => (
        <SheetOption
          key={folder.id}
          focusKey={`SHEET-folder-${index}`}
          active={vm.isInFolder(folder.id)}
          onPress={() => vm.toggleBookmark.mutate(folder)}
        >
          {folder.title}
        </SheetOption>
      ))}
    </Sheet>
  )
})
