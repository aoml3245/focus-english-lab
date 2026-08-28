export type ThemePreference = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'focus-english-lab:theme:v1'
const DARK_QUERY = '(prefers-color-scheme: dark)'

export function loadThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch { return 'system' }
}

export function resolvedTheme(preference = loadThemePreference()): 'light' | 'dark' {
  return preference === 'system'
    ? window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
    : preference
}

export function applyTheme(preference = loadThemePreference()) {
  const theme = resolvedTheme(preference)
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#101819' : '#006b68')
  return theme
}

export function saveThemePreference(preference: ThemePreference) {
  try { localStorage.setItem(STORAGE_KEY, preference) } catch { /* Storage may be disabled. */ }
  return applyTheme(preference)
}

export function watchSystemTheme() {
  const media = window.matchMedia(DARK_QUERY)
  const update = () => { if (loadThemePreference() === 'system') applyTheme('system') }
  media.addEventListener('change', update)
  return () => media.removeEventListener('change', update)
}
