'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { statusService } from '@/services/status.service'
import { workService } from '@/services/work.service'
import { useT } from '@/hooks/useT'
import type { ActivityTag, StatusState } from '@/types'

const TAG_KEYS = { FOCUS: 'focus', BREAK: 'break_', MEETING: 'meeting' } as const

const TAG_COLORS: Record<ActivityTag, string> = {
  FOCUS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 ring-blue-300 dark:ring-blue-600',
  BREAK: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 ring-yellow-300 dark:ring-yellow-600',
  MEETING: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 ring-purple-300 dark:ring-purple-600',
}

const TAG_DOT: Record<ActivityTag, string> = {
  FOCUS: 'bg-blue-500',
  BREAK: 'bg-yellow-400',
  MEETING: 'bg-purple-500',
}

const TAGS: ActivityTag[] = ['FOCUS', 'BREAK', 'MEETING']

function isTag(s: StatusState): s is ActivityTag {
  return s === 'FOCUS' || s === 'BREAK' || s === 'MEETING'
}

export function StatusCard() {
  const t = useT()
  const qc = useQueryClient()

  const { data: summary } = useQuery({
    queryKey: ['work-summary'],
    queryFn: () => workService.getSummary().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: myStatus, isLoading } = useQuery({
    queryKey: ['my-status'],
    queryFn: () => statusService.getMyStatus().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (tag: ActivityTag | null) => statusService.setTag(tag),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-status'] }),
  })

  if (isLoading) return <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 h-40 animate-pulse" />

  const isOnline = summary?.is_active ?? false
  const currentStatus: StatusState = myStatus?.status ?? 'OFFLINE'
  const activeTag: ActivityTag | null = isTag(currentStatus) ? currentStatus : null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
        <h2 className="font-medium text-gray-700 dark:text-slate-300">{t('status')}</h2>
        <span className="ml-auto text-sm text-gray-500 dark:text-slate-400">
          {isOnline ? (activeTag ? t(TAG_KEYS[activeTag]) : t('available')) : t('offline')}
        </span>
      </div>

      {!isOnline ? (
        <p className="text-xs text-gray-400 dark:text-slate-500">{t('no_session')}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {TAGS.map((tag) => {
            const isActive = activeTag === tag
            return (
              <button
                key={tag}
                onClick={() => mutation.mutate(isActive ? null : tag)}
                disabled={mutation.isPending}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                  isActive ? `${TAG_COLORS[tag]} ring-2 ring-offset-1 dark:ring-offset-slate-800` : 'bg-gray-50 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isActive ? TAG_DOT[tag] : 'bg-gray-300 dark:bg-slate-500'}`} />
                {t(TAG_KEYS[tag])}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
