'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { useThemeStore } from '@/store/theme.store'
import { useLocaleStore } from '@/store/locale.store'
import { nowJalaliString } from '@/utils/jalali'
import { useT } from '@/hooks/useT'
import { SSEProvider } from '@/components/SSEProvider'
import { PingNotification } from '@/components/PingNotification'
import type { Role } from '@/types'

const NAV_KEYS = [
  { href: '/dashboard',   key: 'dashboard'   as const, roles: ['SUPERVISOR', 'MEMBER'] as Role[] },
  { href: '/presence',    key: 'presence'    as const, roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] as Role[] },
  { href: '/team',        key: 'team'        as const, roles: ['MANAGER', 'SUPERVISOR'] as Role[] },
  { href: '/calendar',    key: 'calendar'    as const, roles: ['MANAGER', 'SUPERVISOR', 'MEMBER'] as Role[] },
  { href: '/performance', key: 'performance' as const, roles: ['MANAGER', 'SUPERVISOR'] as Role[] },
  { href: '/admin',       key: 'admin'       as const, roles: ['ADMIN'] as Role[] },
]

function JalaliClock() {
  const [display, setDisplay] = useState('')
  useEffect(() => {
    const tick = () => setDisplay(nowJalaliString())
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-xs text-gray-400 dark:text-slate-500 font-mono hidden md:block select-none">
      {display}
    </span>
  )
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore()
  const { theme, toggleTheme } = useThemeStore()
  const { locale, toggleLocale } = useLocaleStore()
  const t = useT()
  const pathname = usePathname()
  const router = useRouter()
  const qc = useQueryClient()

  if (!user) return null

  const links = NAV_KEYS.filter((l) => l.roles.includes(user.role))
  const isRtl = locale === 'fa'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors">
      {/* Single global SSE connection — handles status updates + ping notifications */}
      <SSEProvider userId={user.id} />
      <PingNotification />
      <header className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 py-2.5 flex items-center gap-3">
        <span className="font-bold text-gray-800 dark:text-slate-100 shrink-0 text-sm tracking-tight">remo</span>

        <nav className={`flex items-center gap-0.5 flex-1 ${isRtl ? 'flex-row-reverse' : ''}`}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700/50'
              }`}
            >
              {t(l.key)}
            </Link>
          ))}
        </nav>

        <JalaliClock />

        {/* Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors text-base"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Locale toggle */}
          <button
            onClick={toggleLocale}
            title={locale === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
            className="px-2 h-8 flex items-center justify-center rounded-lg text-xs font-semibold text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 hover:text-gray-700 dark:hover:text-slate-200 transition-colors border border-gray-200 dark:border-slate-600"
          >
            {locale === 'fa' ? 'EN' : 'FA'}
          </button>

          <span className="text-sm text-gray-600 dark:text-slate-300 hidden sm:block mx-1">{user.full_name}</span>
          <span className="text-xs bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded text-gray-500 dark:text-slate-400">{user.role}</span>
          <button
            onClick={() => { clearAuth(); qc.clear(); router.push('/login') }}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-gray-700 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
          >
            {t('logout')}
          </button>
        </div>
      </header>

      <main className="p-5 lg:p-8">{children}</main>
    </div>
  )
}
