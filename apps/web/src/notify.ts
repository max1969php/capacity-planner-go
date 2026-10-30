import type { FlashbarProps } from '@cloudscape-design/components/flashbar'
import { createContext, useCallback, useContext, useState } from 'react'

export type Notify = (type: 'success' | 'error', content: string) => void

export const NotifyContext = createContext<Notify>(() => {})

// useNotify shows a dismissible message in the AppLayout Flashbar.
export const useNotify = () => useContext(NotifyContext)

export function useFlashItems(): [FlashbarProps.MessageDefinition[], Notify] {
  const [items, setItems] = useState<FlashbarProps.MessageDefinition[]>([])
  const notify = useCallback<Notify>((type, content) => {
    const id = crypto.randomUUID()
    const dismiss = () => setItems((prev) => prev.filter((i) => i.id !== id))
    setItems((prev) => [{ id, type, content, dismissible: true, onDismiss: dismiss }, ...prev].slice(0, 3))
  }, [])
  return [items, notify]
}
