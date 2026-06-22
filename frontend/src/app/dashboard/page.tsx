'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'

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
          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{user.role}</span>
          <button
            onClick={() => { clearAuth(); router.push('/login') }}
            className="text-sm text-gray-400 hover:text-gray-700"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="p-8">
        <h1 className="text-xl font-semibold text-gray-800 mb-1">Dashboard</h1>
        <p className="text-sm text-gray-400">Phase 2 coming soon</p>
      </main>
    </div>
  )
}
