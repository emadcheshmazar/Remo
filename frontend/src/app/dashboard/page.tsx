'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { WorkSessionCard } from '@/components/WorkSessionCard'
import { StatusCard } from '@/components/StatusCard'
import { ReportCard } from '@/components/ReportCard'
import { TimelineCard } from '@/components/TimelineCard'
import { calendarService } from '@/services/calendar.service'
import { useT } from '@/hooks/useT'

export default function DashboardPage() {
  const { user, hydrated } = useAuthStore()
  const router = useRouter()
  const t = useT()

  useEffect(() => {
    if (!hydrated) return
    if (!user) router.push('/login')
    else if (user.role === 'ADMIN') router.push('/admin')
    else if (user.role === 'MANAGER') router.push('/calendar')
  }, [user, hydrated, router])

  const { data: todayEntry, isLoading: entryLoading } = useQuery({
    queryKey: ['calendar-today-entry'],
    queryFn: () => calendarService.getMyTodayEntry().then(r => r.data),
    enabled: !!user && user.role === 'MEMBER',
    staleTime: 60_000,
  })

  if (!hydrated || !user || user.role === 'ADMIN' || user.role === 'MANAGER') return null

  const isRemoteDay = user.role !== 'MEMBER' || todayEntry?.day_type === 'REMOTE'
  const stillChecking = user.role === 'MEMBER' && entryLoading

  return (
    <AppLayout>
      <h1 className="text-lg font-semibold text-gray-800 dark:text-slate-100 mb-6">{t('dashboard')}</h1>

      {stillChecking ? (
        <div className="flex flex-wrap gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 h-40 w-64 animate-pulse" />
          <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 h-40 w-64 animate-pulse" />
        </div>
      ) : !isRemoteDay ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-6 max-w-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-400 mb-1">{t('dashboard_inactive')}</p>
              <p className="text-sm text-amber-700 dark:text-amber-500">{t('dashboard_inactive_msg')}</p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-6">
            <WorkSessionCard />
            <StatusCard />
          </div>
          <div className="mt-6 flex flex-wrap gap-6">
            <ReportCard />
            <TimelineCard />
          </div>
        </>
      )}
    </AppLayout>
  )
}
