import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Locale = 'fa' | 'en'

interface LocaleState {
  locale: Locale
  toggleLocale: () => void
  setLocale: (l: Locale) => void
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'fa',
      toggleLocale: () => set((s) => ({ locale: s.locale === 'fa' ? 'en' : 'fa' })),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'rwms-locale' }
  )
)
