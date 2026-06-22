'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { WorkSessionCard } from '@/components/WorkSessionCard'
import { StatusCard } from '@/components/StatusCard'
import { ReportCard } from '@/components/ReportCard'
import { TimelineCard } from '@/components/TimelineCard'

export default function DashboardPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  if (!user) return null

  return (
    <AppLayout>
      <h1 className="text-lg font-semibold text-gray-800 mb-6">Dashboard</h1>
      <div className="flex flex-wrap gap-6">
        <WorkSessionCard />
        <StatusCard />
      </div>
      <div className="mt-6 flex flex-wrap gap-6">
        <ReportCard />
        <TimelineCard />
      </div>
    </AppLayout>
  )
}
