'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useT } from '@/hooks/useT'
import { useThemeStore } from '@/store/theme.store'
import { useLocaleStore } from '@/store/locale.store'
import { getErrorMessage } from '@/utils/errors'
import { PasswordInput } from '@/components/PasswordInput'
import api from '@/services/api'
import type { TokenResponse } from '@/types'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { locale, toggleLocale } = useLocaleStore()
  const t = useT()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post<TokenResponse>('/api/v1/auth/login', { username, password })
      setAuth(data.user, data.access_token)
      const role = data.user.role
      router.push(role === 'ADMIN' ? '/admin' : role === 'MANAGER' ? '/calendar' : '/dashboard')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="remo-shell relative flex min-h-screen items-center justify-center px-4">
      <div className="fixed end-4 top-4 flex gap-2">
        <button onClick={toggleTheme} className="remo-btn-ghost h-8 w-8 !p-0 text-sm" aria-label="theme">
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <button onClick={toggleLocale} className="remo-btn-secondary !px-2.5 !py-1 text-xs font-semibold">
          {locale === 'fa' ? 'EN' : 'FA'}
        </button>
      </div>

      <div className="remo-panel w-full max-w-sm p-7 sm:p-8">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-accent-700 text-white shadow-sm dark:bg-accent-500 dark:text-ink-950">
            <span className="font-display text-lg font-semibold">r</span>
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink-950 dark:text-ink-50">remo</h1>
          <p className="mt-1 text-sm text-ink-400 dark:text-ink-500">کارتیمی از هر جایی</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block">
            <span className="remo-label">{t('username')}</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="remo-input mt-1"
              required
              autoFocus
            />
          </label>
          <label className="block">
            <span className="remo-label">{t('password')}</span>
            <PasswordInput
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="remo-input mt-1"
              required
            />
          </label>
          {error && <p className="text-sm text-heat-600">{error}</p>}
          <button type="submit" disabled={loading} className="remo-btn-primary w-full">
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>
      </div>
    </div>
  )
}
