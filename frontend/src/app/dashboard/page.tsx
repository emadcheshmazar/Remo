'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { WorkSessionCard } from '@/components/WorkSessionCard'
import { StatusCard } from '@/components/StatusCard'
import { ReportCard } from '@/components/ReportCard'
import { TimelineCard } from '@/components/TimelineCard'

export default function DashboardPage() {
  const { user, clearAuth } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    if (!user) router.push('/login')
  }, [user, router])

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-gray-800">RWMS</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{user.full_name}</span>
          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">
            {user.role}
          </span>
          <button
            onClick={() => {
              clearAuth()
              router.push('/login')
            }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="p-8">
        <h1 className="text-lg font-semibold text-gray-800 mb-6">Dashboard</h1>
        <div className="flex flex-wrap gap-6">
          <WorkSessionCard />
          <StatusCard />
        </div>
        <div className="mt-6 flex flex-wrap gap-6">
          <ReportCard />
          <TimelineCard />
        </div>
      </main>
    </div>
  )
}
