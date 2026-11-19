'use client'

import { useEffect, useMemo, useState } from 'react'
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
import type { TKey } from '@/utils/translations'

type NavItem = { href: string; key: TKey; roles: Role[]; group: 'work' | 'people' | 'system' }

const NAV: NavItem[] = [
  { href: '/dashboard', key: 'dashboard', roles: ['SUPERVISOR', 'MEMBER'], group: 'work' },
  { href: '/tasks', key: 'tasks', roles: ['MANAGER', 'SUPERVISOR', 'MEMBER'], group: 'work' },
  { href: '/calendar', key: 'calendar', roles: ['MANAGER', 'SUPERVISOR', 'MEMBER'], group: 'work' },
  { href: '/presence', key: 'presence', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'], group: 'people' },
  { href: '/team', key: 'team', roles: ['MANAGER', 'SUPERVISOR'], group: 'people' },
  { href: '/performance', key: 'performance', roles: ['MANAGER', 'SUPERVISOR'], group: 'people' },
  { href: '/settings/jira', key: 'jira_settings', roles: ['ADMIN', 'MANAGER'], group: 'system' },
  { href: '/admin', key: 'admin', roles: ['ADMIN'], group: 'system' },
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
    <span className="hidden lg:inline text-[11px] font-mono text-ink-400 dark:text-ink-500 select-none tracking-tight">
      {display}
    </span>
  )
}

function NavLink({
  href,
  label,
  active,
  onClick,
}: {
  href: string
  label: string
  active: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`relative px-3 py-2 rounded-xl text-sm font-medium transition ${
        active
          ? 'text-accent-800 bg-accent-50 dark:text-accent-200 dark:bg-accent-900/40'
          : 'text-ink-500 hover:text-ink-900 hover:bg-ink-100/70 dark:text-ink-400 dark:hover:text-ink-100 dark:hover:bg-ink-800/70'
      }`}
    >
      {label}
      {active && (
        <span className="absolute inset-x-3 -bottom-[1px] h-0.5 rounded-full bg-accent-600 dark:bg-accent-400 hidden md:block" />
      )}
    </Link>
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
  const [menuOpen, setMenuOpen] = useState(false)

  const links = useMemo(
    () => (user ? NAV.filter((item) => item.roles.includes(user.role)) : []),
    [user],
  )

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  if (!user) return null

  const work = links.filter((l) => l.group === 'work')
  const people = links.filter((l) => l.group === 'people')
  const system = links.filter((l) => l.group === 'system')

  const renderGroup = (items: NavItem[], onClick?: () => void) =>
    items.map((item) => (
      <NavLink
        key={item.href}
        href={item.href}
        label={t(item.key)}
        active={pathname.startsWith(item.href)}
        onClick={onClick}
      />
    ))

  return (
    <div className="remo-shell">
      <SSEProvider userId={user.id} />
      <PingNotification />

      <header className="sticky top-0 z-40 border-b border-ink-200/70 bg-white/75 backdrop-blur-xl dark:border-ink-800 dark:bg-ink-950/75">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
          <div className="flex h-14 items-center gap-3">
            <Link href={user.role === 'ADMIN' ? '/admin' : '/tasks'} className="flex items-center gap-2 shrink-0 group">
              <span className="grid h-8 w-8 place-items-center rounded-xl bg-accent-700 text-white shadow-sm transition group-hover:scale-105 dark:bg-accent-500 dark:text-ink-950">
                <span className="font-display text-sm font-semibold">r</span>
              </span>
              <span className="font-display text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-50">
                remo
              </span>
            </Link>

            <nav className="hidden md:flex flex-1 items-center gap-1 min-w-0 overflow-x-auto">
              {renderGroup(work)}
              {people.length > 0 && <span className="mx-1 h-4 w-px bg-ink-200 dark:bg-ink-700" />}
              {renderGroup(people)}
              {system.length > 0 && <span className="mx-1 h-4 w-px bg-ink-200 dark:bg-ink-700" />}
              {renderGroup(system)}
            </nav>

            <div className="ms-auto flex items-center gap-1.5">
              <JalaliClock />
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                className="remo-btn-ghost h-9 w-9 !p-0"
              >
                {theme === 'dark' ? '☀' : '☾'}
              </button>
              <button
                onClick={toggleLocale}
                title={locale === 'fa' ? 'Switch to English' : 'تغییر به فارسی'}
                className="remo-btn-secondary h-9 px-2.5 text-[11px] font-semibold"
              >
                {locale === 'fa' ? 'EN' : 'FA'}
              </button>
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-ink-200/80 bg-ink-50/80 px-2.5 py-1.5 dark:border-ink-700 dark:bg-ink-900/70">
                <div className="min-w-0">
                  <div className="truncate text-xs font-medium text-ink-800 dark:text-ink-100">{user.full_name}</div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-400">{user.role}</div>
                </div>
              </div>
              <button
                onClick={() => { clearAuth(); qc.clear(); router.push('/login') }}
                className="remo-btn-ghost text-xs text-ink-500"
              >
                {t('logout')}
              </button>
              <button
                className="md:hidden remo-btn-secondary h-9 w-9 !p-0"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label="Menu"
              >
                {menuOpen ? '×' : '☰'}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-ink-200/80 bg-white/95 px-4 py-3 animate-nav-in dark:border-ink-800 dark:bg-ink-950/95">
            <div className="flex flex-col gap-1">
              {renderGroup(links, () => setMenuOpen(false))}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 animate-fade-up">
        {children}
      </main>
    </div>
  )
}
