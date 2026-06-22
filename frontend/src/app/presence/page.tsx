'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { PresenceBoard } from '@/components/PresenceBoard'

export default function PresencePage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
    else if (user.role === 'MEMBER') router.push('/dashboard')
  }, [user, router])

  if (!user || user.role === 'MEMBER') return null

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-800">Team Presence</h1>
        <span className="text-xs text-gray-400">Auto-refreshes every 30s</span>
      </div>
      <PresenceBoard />
    </AppLayout>
  )
}
