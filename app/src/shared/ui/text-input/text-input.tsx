import { setFocus, useFocusable } from '@noriginmedia/norigin-spatial-navigation'
import { useEffect, useRef } from 'react'
import { cx } from '@/shared/lib/cx'
import styles from './text-input.module.css'

export interface TextInputProps {
  focusKey: string
  placeholder?: string
  /** Enter with a non-empty value; the field blurs first so the TV keyboard closes. */
  onSubmit: (value: string) => void
  /** Focus the field and open the TV keyboard as soon as it appears. */
  autoFocus?: boolean
}

/** A native input: focusing it opens the webOS keyboard, whose mic button dictates. Enter on the wrapper opens it too. */
export function TextInput({ focusKey, placeholder, onSubmit, autoFocus }: TextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const { ref, focused } = useFocusable<object, HTMLDivElement>({
    focusKey,
    onEnterPress: () => inputRef.current?.focus(),
  })

  useEffect(() => {
    if (!autoFocus) return

    // Focusables register asynchronously; the keyboard opens once the element itself has focus.
    const frame = requestAnimationFrame(() => {
      setFocus(focusKey)
      inputRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [autoFocus, focusKey])

  return (
    <div ref={ref} className={cx(styles.wrap, focused && 'is-focused')}>
      <input
        ref={inputRef}
        className={styles.input}
        placeholder={placeholder}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return

          const value = event.currentTarget.value.trim()

          event.currentTarget.blur()
          if (value) onSubmit(value)
        }}
      />
    </div>
  )
}
