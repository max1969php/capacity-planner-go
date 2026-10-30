import { applyMode, Mode } from '@cloudscape-design/global-styles'
import { useEffect, useState } from 'react'

// 'system' follows the OS setting and keeps following it if it changes.
export type ColorPreference = 'system' | 'light' | 'dark'

const storageKey = 'color-mode'
const darkQuery = window.matchMedia('(prefers-color-scheme: dark)')

export function readPreference(): ColorPreference {
  const stored = localStorage.getItem(storageKey)
  return stored === 'light' || stored === 'dark' ? stored : 'system'
}

// applyPreference sets Cloudscape's mode class on <body>; every component
// switches through the design tokens, no extra CSS needed.
export function applyPreference(pref: ColorPreference) {
  const dark = pref === 'dark' || (pref === 'system' && darkQuery.matches)
  applyMode(dark ? Mode.Dark : Mode.Light)
}

export function useColorPreference(): [ColorPreference, (p: ColorPreference) => void] {
  const [pref, setPref] = useState<ColorPreference>(readPreference)

  useEffect(() => {
    applyPreference(pref)
    if (pref === 'system') localStorage.removeItem(storageKey)
    else localStorage.setItem(storageKey, pref)

    if (pref !== 'system') return
    const onChange = () => applyPreference('system')
    darkQuery.addEventListener('change', onChange)
    return () => darkQuery.removeEventListener('change', onChange)
  }, [pref])

  return [pref, setPref]
}
