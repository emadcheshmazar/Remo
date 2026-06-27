'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { workService } from '@/services/work.service'
import { useT } from '@/hooks/useT'

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
  const t = useT()
  const qc = useQueryClient()
  const [elapsed, setElapsed] = useState('00:00:00')
  const [confirm, setConfirm] = useState<'start' | 'end' | null>(null)

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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-summary'] })
      qc.invalidateQueries({ queryKey: ['my-status'] })
      qc.invalidateQueries({ queryKey: ['timeline-today'] })
    },
  })

  const endMutation = useMutation({
    mutationFn: () => workService.end(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['work-summary'] })
      qc.invalidateQueries({ queryKey: ['my-status'] })
      qc.invalidateQueries({ queryKey: ['timeline-today'] })
    },
  })

  if (isLoading) return <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 h-40 animate-pulse" />

  const isActive = summary?.is_active ?? false
  const total = summary?.total_minutes_today ?? 0

  const handleConfirm = () => {
    if (confirm === 'start') startMutation.mutate()
    else if (confirm === 'end') endMutation.mutate()
    setConfirm(null)
  }

  return (
    <>
      {confirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-800 dark:text-slate-100 mb-2">
              {confirm === 'start' ? t('confirm_start') : t('confirm_end')}
            </h3>
            <div className="flex gap-3 justify-end mt-5">
              <button onClick={() => setConfirm(null)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200">
                {t('cancel')}
              </button>
              <button
                onClick={handleConfirm}
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${confirm === 'start' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
              >
                {t('confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 w-full max-w-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-gray-700 dark:text-slate-300">{t('work_session')}</h2>
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
            {isActive ? t('session_active') : t('no_session')}
          </span>
        </div>

        {isActive && (
          <div className="text-3xl font-mono tracking-widest text-gray-800 dark:text-slate-100 mb-4">{elapsed}</div>
        )}

        {!isActive && total > 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">
            {t('today_total')}: <span className="font-semibold text-gray-700 dark:text-slate-200">{formatDuration(total)}</span>
          </p>
        )}

        {!isActive && total === 0 && (
          <p className="text-sm text-gray-400 dark:text-slate-500 mb-4">{t('no_session')}</p>
        )}

        <button
          onClick={() => setConfirm(isActive ? 'end' : 'start')}
          disabled={startMutation.isPending || endMutation.isPending}
          className={`w-full py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${isActive ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'}`}
        >
          {isActive ? t('end_work') : t('start_work')}
        </button>
      </div>
    </>
  )
}
