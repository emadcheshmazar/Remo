'use client'

import { useEffect } from 'react'
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
      <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-6">{t('team')}</h1>
      <UserTable title={t('team')} creatableRoles={creatableRoles} />
    </AppLayout>
  )
}
