'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { UserTable } from '@/components/UserTable'
import type { Role } from '@/types'

const CREATABLE: Record<Role, Role[]> = {
  ADMIN: ['MANAGER'],
  MANAGER: ['SUPERVISOR', 'MEMBER'],
  SUPERVISOR: ['MEMBER'],
  MEMBER: [],
}

export default function TeamPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
    else if (user.role === 'MEMBER') router.push('/dashboard')
  }, [user, router])

  if (!user || user.role === 'MEMBER') return null

  const creatableRoles = CREATABLE[user.role]

  return (
    <AppLayout>
      <h1 className="text-lg font-semibold text-gray-800 mb-6">Team Management</h1>
      <UserTable title="Team Members" creatableRoles={creatableRoles} />
    </AppLayout>
  )
}
