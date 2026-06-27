'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { calendarService } from '@/services/calendar.service'
import { formatJalali, isoToJalali } from '@/utils/jalali'
import { useLocaleStore } from '@/store/locale.store'
import { useT } from '@/hooks/useT'
import type { ApprovalStatus, DayType, EventType } from '@/types'

function fmt(min: number) {
  const h = Math.floor(min / 60), m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function minutesBetween(a: string, b: string) {
  return Math.max(0, Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 60000))
}

// Half-hour options in minutes: 30, 60, 90, ..., 600 (0.5h to 10h)
const HALF_HOUR_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 30)

const EVENT_LABEL_KEY: Record<EventType, 'session_start' | 'session_end' | 'status_change' | 'report_submitted'> = {
  SESSION_START: 'session_start',
  SESSION_END: 'session_end',
  STATUS_CHANGE: 'status_change',
  REPORT_SUBMITTED: 'report_submitted',
}

const EVENT_DOT: Record<EventType, string> = {
  SESSION_START: 'bg-green-500',
  SESSION_END: 'bg-red-400',
  STATUS_CHANGE: 'bg-blue-400',
  REPORT_SUBMITTED: 'bg-purple-500',
}

const STATUS_KEY_MAP: Record<string, 'available' | 'offline' | 'focus' | 'break_' | 'meeting'> = {
  AVAILABLE: 'available', OFFLINE: 'offline',
  FOCUS: 'focus', BREAK: 'break_', MEETING: 'meeting',
}

const TYPE_CONFIG: Record<DayType, { bg: string; text: string; key: 'remote' | 'leave' }> = {
  REMOTE: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', key: 'remote' },
  LEAVE:  { bg: 'bg-red-50 dark:bg-red-900/20',  text: 'text-red-700 dark:text-red-400',   key: 'leave'  },
}

const STAT_COLOR = [
  'text-green-600 dark:text-green-400',
  'text-blue-600 dark:text-blue-400',
  'text-yellow-600 dark:text-yellow-500',
  'text-purple-600 dark:text-purple-400',
]

interface Props {
  userId: string
  isoDate: string
  canEdit: boolean
  canViewDetail: boolean   // MANAGER or SUPERVISOR (for their team) — sees timeline, reports, approval status
  canApprove: boolean      // Only SUPERVISOR for their direct team members
  onSetDayType: (dt: DayType | null) => void
  isPending?: boolean
}

export function DayDetail({ userId, isoDate, canEdit, canViewDetail, canApprove, onSetDayType, isPending }: Props) {
  const t = useT()
  const qc = useQueryClient()
  const { locale } = useLocaleStore()
  const [jy, jm, jd] = isoToJalali(isoDate)
  const [customMin, setCustomMin] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['day-stats', userId, isoDate],
    queryFn: () => calendarService.getDayStats(userId, isoDate).then(r => r.data),
    enabled: canViewDetail,
  })

  const { data: timeline, isLoading: tlLoading } = useQuery({
    queryKey: ['timeline-date', userId, isoDate],
    queryFn: () => calendarService.getTimelineByDate(userId, isoDate).then(r => r.data),
    enabled: canViewDetail,
  })

  const { data: report } = useQuery({
    queryKey: ['report-date', userId, isoDate],
    queryFn: () => calendarService.getReportByDate(userId, isoDate).then(r => r.data),
    enabled: canViewDetail,
  })

  const approveMutation = useMutation({
    mutationFn: ({ status, approved_minutes }: { status: ApprovalStatus; approved_minutes: number | null }) =>
      calendarService.approveDay(userId, isoDate, status, approved_minutes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-stats', userId, isoDate] })
      qc.invalidateQueries({ queryKey: ['calendar-team'] })
    },
  })

  const clearMutation = useMutation({
    mutationFn: () => calendarService.clearApproval(userId, isoDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['day-stats', userId, isoDate] })
      qc.invalidateQueries({ queryKey: ['calendar-team'] })
    },
  })

  const dayType = stats?.day_type ?? null
  const isLeave = dayType === 'LEAVE'
  const approvalStatus = stats?.approval_status ?? null
  const approvedMinutes = stats?.approved_minutes ?? null

  function formatHours(min: number) {
    const h = min / 60
    return locale === 'fa' ? `${h} ساعت` : `${h}h`
  }

  function handleApprove(status: ApprovalStatus, minutes: number | null) {
    approveMutation.mutate({ status, approved_minutes: minutes })
    setShowCustom(false)
    setCustomMin('')
  }

  if (!canViewDetail) return null

  return (
    <div dir="rtl" className="space-y-3">
      {/* Date header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">{formatJalali(jy, jm, jd)}</h3>
        {dayType && (
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${TYPE_CONFIG[dayType].bg} ${TYPE_CONFIG[dayType].text}`}>
            {t(TYPE_CONFIG[dayType].key)}
          </span>
        )}
      </div>

      {/* Set day type buttons — only for canEdit */}
      {canEdit && (
        <div className="flex items-center gap-2 flex-wrap">
          {(['REMOTE', 'LEAVE'] as DayType[]).map((dt) => (
            <button
              key={dt}
              disabled={isPending}
              onClick={() => onSetDayType(dayType === dt ? null : dt)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors disabled:opacity-50
                ${dayType === dt
                  ? `${TYPE_CONFIG[dt].bg} ${TYPE_CONFIG[dt].text} border-current font-medium`
                  : 'border-gray-200 dark:border-slate-600 text-gray-500 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-500'
                }`}
            >
              {t(TYPE_CONFIG[dt].key)}
            </button>
          ))}
        </div>
      )}

      {isLeave && (
        <p className="text-sm text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
          {t('leave')} ثبت شده
        </p>
      )}

      {!isLeave && (
        <>
          {/* Work stats */}
          {statsLoading ? (
            <div className="h-16 bg-gray-50 dark:bg-slate-700 rounded-lg animate-pulse" />
          ) : stats && (stats.total_work_minutes > 0 || stats.focus_minutes > 0) ? (
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: t('today_total'), value: fmt(stats.total_work_minutes), ci: 0 },
                { label: t('focus'),       value: fmt(stats.focus_minutes),       ci: 1 },
                { label: t('break_'),      value: fmt(stats.break_minutes),       ci: 2 },
                { label: t('meeting'),     value: fmt(stats.meeting_minutes),     ci: 3 },
              ].map((s) => (
                <div key={s.label} className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2.5">
                  <p className="text-xs text-gray-400 dark:text-slate-500">{s.label}</p>
                  <p className={`text-sm font-semibold ${STAT_COLOR[s.ci]}`}>{s.value || '—'}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 dark:text-slate-500">{t('no_events')}</p>
          )}

          {/* Approval section — visible to all with canViewDetail for REMOTE days */}
          {dayType === 'REMOTE' && (
            <div className="border border-gray-100 dark:border-slate-700 rounded-lg p-3 space-y-2.5">
              <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                {t('approve_work')}
              </p>

              {/* Current approval status (read-only for MANAGER, actionable for SUPERVISOR) */}
              {approvalStatus === 'APPROVED' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                    ✓ {t('approved')} — {approvedMinutes != null ? formatHours(approvedMinutes) : fmt(stats?.total_work_minutes ?? 0)}
                  </span>
                  {canApprove && (
                    <button
                      disabled={clearMutation.isPending}
                      onClick={() => clearMutation.mutate()}
                      title={t('clear_approval')}
                      className="text-[10px] px-2 py-0.5 rounded text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      ✕ {t('clear_approval')}
                    </button>
                  )}
                </div>
              )}
              {approvalStatus === 'REJECTED' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-red-500 dark:text-red-400 font-medium">✗ {t('rejected_work')}</span>
                  {canApprove && (
                    <button
                      disabled={clearMutation.isPending}
                      onClick={() => clearMutation.mutate()}
                      title={t('clear_approval')}
                      className="text-[10px] px-2 py-0.5 rounded text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                    >
                      ✕ {t('clear_approval')}
                    </button>
                  )}
                </div>
              )}
              {!approvalStatus && (
                <span className="text-xs text-gray-400 dark:text-slate-500">{t('pending_approval')}</span>
              )}

              {/* Action buttons — only for SUPERVISOR (canApprove) */}
              {canApprove && (
                <div className="space-y-2">
                  {/* Half-hour select for custom approval */}
                  {showCustom && (
                    <div className="flex items-center gap-1.5">
                      <select
                        value={customMin}
                        onChange={e => setCustomMin(e.target.value)}
                        className="flex-1 text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                      >
                        <option value="">{t('select_hours')}</option>
                        {HALF_HOUR_OPTIONS.map(min => (
                          <option key={min} value={min}>{formatHours(min)}</option>
                        ))}
                      </select>
                      <button
                        disabled={!customMin || approveMutation.isPending}
                        onClick={() => handleApprove('APPROVED', parseInt(customMin))}
                        className="text-xs px-2.5 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => { setShowCustom(false); setCustomMin('') }}
                        className="text-xs px-2 py-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    <button
                      disabled={approveMutation.isPending}
                      onClick={() => handleApprove('APPROVED', null)}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors disabled:opacity-50
                        ${approvalStatus === 'APPROVED' && approvedMinutes == null
                          ? 'bg-green-600 text-white'
                          : 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50'
                        }`}
                    >
                      ✓ {t('approve_all')}
                    </button>
                    <button
                      disabled={approveMutation.isPending}
                      onClick={() => { setShowCustom(!showCustom); setCustomMin('') }}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors
                        ${showCustom
                          ? 'bg-indigo-600 text-white'
                          : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50'
                        }`}
                    >
                      ✎ {t('approve_custom')}
                    </button>
                    <button
                      disabled={approveMutation.isPending}
                      onClick={() => handleApprove('REJECTED', null)}
                      className={`text-xs px-2.5 py-1.5 rounded font-medium transition-colors disabled:opacity-50
                        ${approvalStatus === 'REJECTED'
                          ? 'bg-red-500 text-white'
                          : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                        }`}
                    >
                      ✗ {t('reject_work')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Timeline */}
          {!tlLoading && timeline && timeline.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">{t('timeline')}</p>
              <ol className="space-y-0">
                {[...timeline].sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()).map((ev, i, arr) => {
                  const next = arr[i + 1]
                  const dur = next ? minutesBetween(ev.occurred_at, next.occurred_at) : null
                  const toStatus = ev.payload?.to as string | undefined
                  return (
                    <li key={ev.id} className="flex items-start gap-2 py-1.5">
                      <div className="flex flex-col items-center mt-1 shrink-0">
                        <span className={`w-2 h-2 rounded-full ${EVENT_DOT[ev.event_type]}`} />
                        {dur !== null && <span className="w-px bg-gray-200 dark:bg-slate-600 flex-1 mt-0.5" style={{ minHeight: 14 }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-gray-700 dark:text-slate-300">{t(EVENT_LABEL_KEY[ev.event_type])}</span>
                        {toStatus && STATUS_KEY_MAP[toStatus] && (
                          <span className="text-xs text-gray-400 dark:text-slate-500 mr-1">← {t(STATUS_KEY_MAP[toStatus])}</span>
                        )}
                        {dur !== null && dur > 0 && (
                          <p className="text-[10px] text-gray-400 dark:text-slate-500">{fmt(dur)}</p>
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
          {report && (
            <div className="border-t border-gray-100 dark:border-slate-700 pt-3 space-y-2">
              <p className="text-xs font-medium text-gray-500 dark:text-slate-400">{t('daily_report')}</p>
              {report.today_text && (
                <p className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{report.today_text}</p>
              )}
              {report.blockers_text && (
                <div>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500">موانع</p>
                  <p className="text-xs text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{report.blockers_text}</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
