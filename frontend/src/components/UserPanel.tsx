'use client'

import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { calendarService } from '@/services/calendar.service'
import { jalaliToIso, todayJalali } from '@/utils/jalali'
import { useT } from '@/hooks/useT'
import type { TKey } from '@/utils/translations'
import type { EventType, Role, StatusState, User } from '@/types'

interface Props {
  user: User & { status: StatusState }
  viewerRole: Role
  onClose: () => void
}

const STATUS_COLOR: Record<StatusState, string> = {
  AVAILABLE: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700',
  OFFLINE:   'text-gray-500 dark:text-slate-400 bg-gray-50 dark:bg-slate-700 border-gray-200 dark:border-slate-600',
  FOCUS:     'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700',
  BREAK:     'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700',
  MEETING:   'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700',
}

const STATUS_DOT: Record<StatusState, string> = {
  AVAILABLE: 'bg-green-500', OFFLINE: 'bg-gray-300 dark:bg-slate-500',
  FOCUS: 'bg-blue-500', BREAK: 'bg-yellow-400', MEETING: 'bg-purple-500',
}

const STATUS_KEY: Record<StatusState, 'available' | 'offline' | 'focus' | 'break_' | 'meeting'> = {
  AVAILABLE: 'available', OFFLINE: 'offline', FOCUS: 'focus', BREAK: 'break_', MEETING: 'meeting',
}

const ROLE_KEY: Record<Role, 'role_admin' | 'role_manager' | 'role_supervisor' | 'role_member'> = {
  ADMIN: 'role_admin', MANAGER: 'role_manager', SUPERVISOR: 'role_supervisor', MEMBER: 'role_member',
}

const EVENT_DOT: Record<EventType, string> = {
  SESSION_START: 'bg-green-500',
  SESSION_END: 'bg-red-400',
  STATUS_CHANGE: 'bg-blue-400',
  REPORT_SUBMITTED: 'bg-purple-500',
}

const EVENT_KEY: Record<EventType, TKey> = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  STATUS_CHANGE: 'status_change',
  REPORT_SUBMITTED: 'report_submitted',
}

function fmt(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function UserPanel({ user, viewerRole, onClose }: Props) {
  const router = useRouter()
  const t = useT()
  const { user: me } = useAuthStore()

  const todayIso = jalaliToIso(...todayJalali())

  // Can viewer see today's work details for this user?
  const canViewTodayWork =
    viewerRole === 'MANAGER' ||
    (viewerRole === 'SUPERVISOR' && user.supervisor_id === me?.id)

  const { data: todayStats } = useQuery({
    queryKey: ['day-stats', user.id, todayIso],
    queryFn: () => calendarService.getDayStats(user.id, todayIso).then(r => r.data),
    enabled: canViewTodayWork,
  })

  const { data: todayTimeline } = useQuery({
    queryKey: ['timeline-date', user.id, todayIso],
    queryFn: () => calendarService.getTimelineByDate(user.id, todayIso).then(r => r.data),
    enabled: canViewTodayWork,
  })

  const { data: todayReport } = useQuery({
    queryKey: ['report-date', user.id, todayIso],
    queryFn: () => calendarService.getReportByDate(user.id, todayIso).then(r => r.data),
    enabled: canViewTodayWork,
  })

  const sortedTimeline = todayTimeline
    ? [...todayTimeline].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime())
    : []

  const canViewCalendar = viewerRole === 'MANAGER' || viewerRole === 'SUPERVISOR'

  return (
    <div className="fixed inset-0 z-40 flex" dir="ltr">
      <div className="flex-1 bg-black/20 dark:bg-black/40" onClick={onClose} />
      <div className="w-80 bg-white dark:bg-slate-800 shadow-2xl flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <button onClick={onClose} className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300">✕</button>
          <div className="min-w-0">
            <p className="font-semibold text-gray-800 dark:text-slate-100 text-sm truncate">{user.full_name}</p>
            <p className="text-xs text-gray-400 dark:text-slate-500">@{user.username}</p>
          </div>
          <span className="mr-auto text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded">{t(ROLE_KEY[user.role])}</span>
        </div>

        <div className="p-4 flex-1 space-y-5">
          {/* Current status */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t('current_status')}</p>
            <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border ${STATUS_COLOR[user.status]}`}>
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[user.status]}`} />
              <span className="text-sm font-medium">{t(STATUS_KEY[user.status])}</span>
            </div>
          </div>

          {/* Today's work — only for permitted viewers */}
          {canViewTodayWork && (
            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t('today_work')}</p>

              {/* Work stats */}
              {todayStats && todayStats.total_work_minutes > 0 ? (
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  {[
                    { label: t('today_total'), value: fmt(todayStats.total_work_minutes), color: 'text-green-600 dark:text-green-400' },
                    { label: t('focus'),       value: fmt(todayStats.focus_minutes),       color: 'text-blue-600 dark:text-blue-400' },
                    { label: t('break_'),      value: fmt(todayStats.break_minutes),       color: 'text-yellow-600 dark:text-yellow-500' },
                    { label: t('meeting'),     value: fmt(todayStats.meeting_minutes),     color: 'text-purple-600 dark:text-purple-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500">{s.label}</p>
                      <p className={`text-xs font-semibold ${s.color}`}>{s.value || '—'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">{t('no_events')}</p>
              )}

              {/* Timeline */}
              {sortedTimeline.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1.5">{t('timeline')}</p>
                  <ol className="space-y-0">
                    {sortedTimeline.map((ev, i) => {
                      const next = sortedTimeline[i + 1]
                      const toStatus = ev.payload?.to as string | undefined
                      return (
                        <li key={ev.id} className="flex items-start gap-2 py-1">
                          <div className="flex flex-col items-center mt-1 shrink-0">
                            <span className={`w-1.5 h-1.5 rounded-full ${EVENT_DOT[ev.event_type]}`} />
                            {next && <span className="w-px bg-gray-200 dark:bg-slate-600 mt-0.5" style={{ minHeight: 10 }} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[11px] text-gray-700 dark:text-slate-300">{t(EVENT_KEY[ev.event_type])}</span>
                            {toStatus && (
                              <span className="text-[10px] text-gray-400 dark:text-slate-500 mr-1">← {toStatus}</span>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 shrink-0">{fmtTime(ev.occurred_at)}</span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {/* Report */}
              {todayReport?.today_text && (
                <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-3">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">{t('daily_report')}</p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap line-clamp-4">{todayReport.today_text}</p>
                  {todayReport.blockers_text && (
                    <p className="text-[10px] text-red-400 dark:text-red-400 mt-1 line-clamp-2">⚠ {todayReport.blockers_text}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Basic info */}
          <div>
            <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-2">{t('info')}</p>
            <div className="space-y-1.5 text-sm text-gray-600 dark:text-slate-400">
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-500">{t('role')}</span>
                <span className="font-medium text-gray-700 dark:text-slate-200">{t(ROLE_KEY[user.role])}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400 dark:text-slate-500">{t('username')}</span>
                <span className="font-mono text-xs text-gray-600 dark:text-slate-300">{user.username}</span>
              </div>
            </div>
          </div>
        </div>

        {canViewCalendar && (
          <div className="p-4 border-t border-gray-100 dark:border-slate-700 sticky bottom-0 bg-white dark:bg-slate-800">
            <button
              onClick={() => { onClose(); router.push(`/calendar?user_id=${user.id}`) }}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {t('view_calendar')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
