'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { UserTable } from '@/components/UserTable'

export default function AdminPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
    else if (user.role !== 'ADMIN') router.push('/dashboard')
  }, [user, router])

  if (!user || user.role !== 'ADMIN') return null

  return (
    <AppLayout>
      <h1 className="text-lg font-semibold text-gray-800 mb-6">Admin Panel</h1>
      <UserTable title="Managers" creatableRoles={['MANAGER']} />
    </AppLayout>
  )
}
