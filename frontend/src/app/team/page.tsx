'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { UserTable } from '@/components/UserTable'
import { useT } from '@/hooks/useT'
import type { Role } from '@/types'

const CREATABLE: Record<Role, Role[]> = {
  ADMIN: ['MANAGER'],
  MANAGER: ['SUPERVISOR', 'MEMBER'],
  SUPERVISOR: ['MEMBER'],
  MEMBER: [],
}

export default function TeamPage() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role === 'MEMBER') router.push('/dashboard')
  }, [user, hydrated, router])

  if (!hydrated || !user || user.role === 'MEMBER') return null

  const creatableRoles = CREATABLE[user.role]

  return (
    <AppLayout>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-accent-700 dark:text-accent-300">{t('task_workspace')}</p>
          <h1 className="font-display text-xl font-semibold text-ink-900 dark:text-ink-50">{t('team')}</h1>
        </div>
        {(user.role === 'MANAGER' || user.role === 'ADMIN') && (
          <Link href="/settings/jira" className="remo-btn-secondary text-xs">
            {t('jira_people_sync')}
          </Link>
        )}
      </div>
      <UserTable title={t('team')} creatableRoles={creatableRoles} />
    </AppLayout>
  )
}
