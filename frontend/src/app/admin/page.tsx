'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { UserTable } from '@/components/UserTable'
import { useT } from '@/hooks/useT'

export default function AdminPage() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role !== 'ADMIN') router.push('/dashboard')
  }, [user, hydrated, router])

  if (!hydrated || !user || user.role !== 'ADMIN') return null

  return (
    <AppLayout>
      <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-6">{t('admin')}</h1>
      <UserTable title={t('admin')} creatableRoles={['MANAGER']} />
    </AppLayout>
  )
}
