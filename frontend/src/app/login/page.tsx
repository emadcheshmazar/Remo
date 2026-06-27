'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { useT } from '@/hooks/useT'
import { useThemeStore } from '@/store/theme.store'
import { useLocaleStore } from '@/store/locale.store'
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
    } catch {
      setError(t('error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Theme / Locale toggles */}
      <div className="fixed top-4 right-4 flex gap-2">
        <button
          onClick={toggleTheme}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <button
          onClick={toggleLocale}
          className="px-2 h-8 rounded-lg text-xs font-semibold text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-600 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          {locale === 'fa' ? 'EN' : 'FA'}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1 text-center text-gray-900 dark:text-slate-100 tracking-tight">remo</h1>
        <p className="text-sm text-gray-400 dark:text-slate-500 text-center mb-6">کارتیمی از هر جایی</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('username')}</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-200 dark:border-slate-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-slate-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              required
            />
          </div>
          {error && <p className="text-red-500 dark:text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 dark:bg-indigo-700 text-white py-2 rounded-md text-sm font-medium hover:bg-gray-700 dark:hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>
      </div>
    </div>
  )
}
