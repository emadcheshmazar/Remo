'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workService } from '@/services/work.service'

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatElapsed(startedAt: string): string {
  const diff = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  const h = Math.floor(diff / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const s = diff % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function WorkSessionCard() {
  const qc = useQueryClient()
  const [elapsed, setElapsed] = useState('00:00:00')

  const { data: summary, isLoading } = useQuery({
    queryKey: ['work-summary'],
    queryFn: () => workService.getSummary().then((r) => r.data),
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!summary?.is_active || !summary.session) return
    const startedAt = summary.session.started_at
    const tick = () => setElapsed(formatElapsed(startedAt))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [summary?.is_active, summary?.session?.started_at])

  const startMutation = useMutation({
    mutationFn: () => workService.start(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-summary'] }),
  })

  const endMutation = useMutation({
    mutationFn: () => workService.end(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-summary'] }),
  })

  if (isLoading) {
    return <div className="bg-white rounded-lg border p-6 h-40 animate-pulse" />
  }

  const isActive = summary?.is_active ?? false
  const total = summary?.total_minutes_today ?? 0

  return (
    <div className="bg-white rounded-lg border p-6 w-full max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-gray-700">Work Session</h2>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${
            isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {isActive ? 'Active' : 'Idle'}
        </span>
      </div>

      {isActive && (
        <div className="text-3xl font-mono tracking-widest text-gray-800 mb-4">
          {elapsed}
        </div>
      )}

      {!isActive && total > 0 && (
        <p className="text-sm text-gray-500 mb-4">
          Today total:{' '}
          <span className="font-semibold text-gray-700">{formatDuration(total)}</span>
        </p>
      )}

      {!isActive && total === 0 && (
        <p className="text-sm text-gray-400 mb-4">No sessions today</p>
      )}

      <button
        onClick={() => (isActive ? endMutation.mutate() : startMutation.mutate())}
        disabled={startMutation.isPending || endMutation.isPending}
        className={`w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${
          isActive
            ? 'bg-red-500 hover:bg-red-600 text-white'
            : 'bg-green-500 hover:bg-green-600 text-white'
        }`}
      >
        {isActive ? 'Stop Work' : 'Start Work'}
      </button>
    </div>
  )
}
