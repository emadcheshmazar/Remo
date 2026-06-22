'use client'

import { useQuery } from '@tanstack/react-query'
import { timelineService } from '@/services/timeline.service'
import type { EventType, TimelineEvent } from '@/types'

const EVENT_LABEL: Record<EventType, string> = {
  SESSION_START: 'Started work session',
  SESSION_END: 'Ended work session',
  STATUS_CHANGE: 'Changed status',
  REPORT_SUBMITTED: 'Submitted daily report',
}

const EVENT_COLOR: Record<EventType, string> = {
  SESSION_START: 'bg-green-500',
  SESSION_END: 'bg-red-400',
  STATUS_CHANGE: 'bg-blue-500',
  REPORT_SUBMITTED: 'bg-purple-500',
}

function eventDetail(event: TimelineEvent): string {
  if (event.event_type === 'SESSION_END' && event.payload.duration_minutes != null) {
    const m = event.payload.duration_minutes as number
    const h = Math.floor(m / 60)
    const min = m % 60
    return h > 0 ? `${h}h ${min}m` : `${min}m`
  }
  if (event.event_type === 'STATUS_CHANGE' && event.payload.to) {
    return String(event.payload.to).charAt(0) + String(event.payload.to).slice(1).toLowerCase()
  }
  return ''
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function TimelineCard() {
  const { data: events, isLoading } = useQuery({
    queryKey: ['timeline-today'],
    queryFn: () => timelineService.getToday().then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (isLoading) return <div className="bg-white rounded-lg border p-6 animate-pulse h-48 w-full max-w-lg" />

  return (
    <div className="bg-white rounded-lg border p-6 w-full max-w-lg">
      <h2 className="font-medium text-gray-700 mb-4">Today's Timeline</h2>

      {!events?.length && (
        <p className="text-sm text-gray-400">No events yet today</p>
      )}

      <ol className="space-y-3">
        {events?.map((event) => {
          const detail = eventDetail(event)
          return (
            <li key={event.id} className="flex items-start gap-3">
              <div className="mt-1.5 shrink-0">
                <span className={`block w-2 h-2 rounded-full ${EVENT_COLOR[event.event_type]}`} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-700">{EVENT_LABEL[event.event_type]}</span>
                {detail && (
                  <span className="text-sm text-gray-400 ml-1.5">— {detail}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 shrink-0">{formatTime(event.occurred_at)}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
