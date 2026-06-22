'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import type { Role } from '@/types'

const NAV: { href: string; label: string; roles: Role[] }[] = [
  { href: '/dashboard', label: 'Dashboard', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR', 'MEMBER'] },
  { href: '/presence', label: 'Presence', roles: ['ADMIN', 'MANAGER', 'SUPERVISOR'] },
  { href: '/team', label: 'Team', roles: ['MANAGER', 'SUPERVISOR'] },
  { href: '/admin', label: 'Admin', roles: ['ADMIN'] },
]

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore()
  const pathname = usePathname()
  const router = useRouter()

  if (!user) return null

  const links = NAV.filter((l) => l.roles.includes(user.role))

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <span className="font-semibold text-gray-800 shrink-0">RWMS</span>
        <nav className="flex items-center gap-1 flex-1">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                pathname.startsWith(l.href)
                  ? 'bg-gray-100 text-gray-900'
                  : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-gray-500">{user.full_name}</span>
          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-500">{user.role}</span>
          <button
            onClick={() => { clearAuth(); router.push('/login') }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-8">{children}</main>
    </div>
  )
}
