import type { ReactNode } from 'react'
import { FocusGroup, Pressable, type PressableProps } from '@/shared/ui/focus'
import { useOptionalPage } from '@/shared/ui/page-context'
import styles from './list.module.css'

export function List({ children, focusKey }: { children: ReactNode; focusKey: string }) {
  return (
    <FocusGroup focusKey={focusKey} className={styles.list}>
      {children}
    </FocusGroup>
  )
}

export interface ListItemProps extends Pick<PressableProps, 'focusKey' | 'onPress' | 'onArrow'> {
  name: ReactNode
  description?: ReactNode
  value?: ReactNode
}

export function ListItem({ name, description, value, ...pressable }: ListItemProps) {
  const page = useOptionalPage()?.page

  return (
    // Rows report their own focus: a list taller than the screen must scroll the page to the focused row.
    <Pressable {...pressable} className={styles.item} onFocus={({ node }) => page?.reveal(node)}>
      <div>
        <div className={styles.name}>{name}</div>
        {description && <div className={styles.description}>{description}</div>}
      </div>
      {value !== undefined && <div className={styles.value}>{value}</div>}
    </Pressable>
  )
}
