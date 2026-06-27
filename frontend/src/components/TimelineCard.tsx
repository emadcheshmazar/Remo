'use client'

import { useQuery } from '@tanstack/react-query'
import { timelineService } from '@/services/timeline.service'
import { useT } from '@/hooks/useT'
import type { EventType, TimelineEvent } from '@/types'

const EVENT_TYPE_KEY = {
  SESSION_START:    'session_start',
  SESSION_END:      'session_end',
  STATUS_CHANGE:    'status_change',
  REPORT_SUBMITTED: 'report_submitted',
} as const

const EVENT_COLOR: Record<EventType, string> = {
  SESSION_START:    'bg-green-500',
  SESSION_END:      'bg-red-400',
  STATUS_CHANGE:    'bg-blue-400',
  REPORT_SUBMITTED: 'bg-purple-500',
}

const TAG_KEY: Record<string, 'available' | 'offline' | 'focus' | 'break_' | 'meeting'> = {
  AVAILABLE: 'available',
  OFFLINE:   'offline',
  FOCUS:     'focus',
  BREAK:     'break_',
  MEETING:   'meeting',
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDur(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function minutesBetween(a: string, b: string): number {
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

export function TimelineCard() {
  const t = useT()
  const { data: events, isLoading } = useQuery({
    queryKey: ['timeline-today'],
    queryFn: () => timelineService.getToday().then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 animate-pulse h-48 w-full max-w-lg" />

  const sorted = [...(events ?? [])].sort(
    (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
  )

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 w-full max-w-lg">
      <h2 className="font-medium text-gray-700 dark:text-slate-300 mb-4">{t('timeline')}</h2>

      {!sorted.length && <p className="text-sm text-gray-400 dark:text-slate-500">{t('no_events')}</p>}

      <ol className="space-y-0">
        {sorted.map((event, i) => {
          const next = sorted[i + 1]
          const dur = next ? minutesBetween(event.occurred_at, next.occurred_at) : null
          const tag = (event.payload.to as string | undefined) ?? null
          const tagKey = tag && TAG_KEY[tag] ? TAG_KEY[tag] : null

          return (
            <li key={event.id}>
              <div className="flex items-start gap-3 py-2">
                <div className="mt-1.5 shrink-0 flex flex-col items-center">
                  <span className={`block w-2.5 h-2.5 rounded-full ${EVENT_COLOR[event.event_type]}`} />
                  {dur !== null && <span className="w-px flex-1 bg-gray-200 dark:bg-slate-600 mt-1" style={{ minHeight: 20 }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm text-gray-700 dark:text-slate-300">{t(EVENT_TYPE_KEY[event.event_type])}</span>
                    {tagKey && <span className="text-xs text-gray-500 dark:text-slate-400">→ {t(tagKey)}</span>}
                    {event.event_type === 'SESSION_END' && event.payload.duration_minutes != null && (
                      <span className="text-xs text-gray-400 dark:text-slate-500">({formatDur(event.payload.duration_minutes as number)})</span>
                    )}
                  </div>
                  {dur !== null && dur > 0 && (
                    <span className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 block">{formatDur(dur)}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 dark:text-slate-500 shrink-0">{formatTime(event.occurred_at)}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
