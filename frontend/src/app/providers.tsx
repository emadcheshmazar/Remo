'use client'

import { useEffect, useRef } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/store/auth.store'
import { useThemeStore } from '@/store/theme.store'
import { useLocaleStore } from '@/store/locale.store'
import api from '@/services/api'
import type { Me } from '@/types'

function AuthInitializer() {
  const { setAuth, clearAuth, setHydrated } = useAuthStore()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const token = localStorage.getItem('access_token')
    if (!token) {
      setHydrated()
      return
    }

    api
      .get<Me>('/api/v1/auth/me')
      .then((r) => setAuth(r.data, token))
      .catch(() => { clearAuth(); queryClient.clear() })
  }, [setAuth, clearAuth, setHydrated])

  return null
}

function ThemeInitializer() {
  const theme = useThemeStore((s) => s.theme)
  const locale = useLocaleStore((s) => s.locale)

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
  }, [theme])

  useEffect(() => {
    document.documentElement.dir = locale === 'fa' ? 'rtl' : 'ltr'
    document.documentElement.lang = locale
  }, [locale])

  return null
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer />
      <ThemeInitializer />
      {children}
    </QueryClientProvider>
  )
}
