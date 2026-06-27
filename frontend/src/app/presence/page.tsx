'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { PresenceBoard } from '@/components/PresenceBoard'
import { useT } from '@/hooks/useT'

export default function PresencePage() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role === 'MEMBER') router.push('/dashboard')
  }, [user, hydrated, router])

  if (!hydrated || !user || user.role === 'MEMBER') return null

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-100">{t('presence')}</h1>
        <span className="text-xs text-gray-400 dark:text-slate-500 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />Live
        </span>
      </div>
      <PresenceBoard />
    </AppLayout>
  )
}
