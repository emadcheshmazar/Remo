'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { calendarService } from '@/services/calendar.service'
import { etsPeriodIsoRange, etsPeriodOf, isoToJalali, JALALI_MONTHS, todayJalali } from '@/utils/jalali'
import { ROLE_TEXT_COLOR } from '@/utils/roleColors'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/locale.store'
import type { ApprovalStatus, DayEntry, DayType, User } from '@/types'

// Half-hour options in minutes: 30, 60, 90, ..., 600 (0.5h to 10h)
const HALF_HOUR_OPTIONS = Array.from({ length: 20 }, (_, i) => (i + 1) * 30)

const TYPE_BADGE: Record<DayType, { cls: string; label: { fa: string; en: string } }> = {
  REMOTE: { cls: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700', label: { fa: 'ریموت', en: 'Remote' } },
  LEAVE:  { cls: 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700',   label: { fa: 'مرخصی', en: 'Leave'  } },
}

const APPROVAL_BADGE: Record<ApprovalStatus, { cls: string; icon: string }> = {
  APPROVED: { cls: 'text-green-600 dark:text-green-400', icon: '✓' },
  REJECTED: { cls: 'text-red-500 dark:text-red-400',     icon: '✗' },
}

const JALALI_MONTHS_EN = [
  'Farvardin','Ordibehesht','Khordad','Tir','Mordad','Shahrivar',
  'Mehr','Aban','Azar','Dey','Bahman','Esfand',
]

function StatCard({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 text-center shadow-sm">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">{label}</p>
    </div>
  )
}

export default function PerformancePage() {
  const { user: me, hydrated } = useAuthStore()
  const router = useRouter()
  const qc = useQueryClient()
  const t = useT()
  const { locale } = useLocaleStore()

  const [jYear, setJYear] = useState(todayJalali()[0])
  const [selectedUserId, setSelectedUserId] = useState('')
  const [customFor, setCustomFor] = useState<string | null>(null)
  const [customMin, setCustomMin] = useState('')

  const { data: users } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: () => calendarService.getCalendarUsers().then(r => r.data),
    enabled: !!me,
  })

  // getCalendarUsers() returns the whole org (for remote/leave visibility),
  // but opening someone's day-by-day detail here is narrower: MANAGER can
  // open anyone's, SUPERVISOR only their own + their direct reports'.
  function canViewDetail(u: User): boolean {
    if (!me) return false
    if (me.role === 'MANAGER') return true
    if (me.role === 'SUPERVISOR') return u.id === me.id || u.supervisor_id === me.id
    return false
  }

  const selectableUsers = useMemo(() => (users ?? []).filter(canViewDetail), [users, me])

  // ETS year: period Farvardin (24 Esfand prev → 23 Farvardin) through Esfand
  const yearStart = etsPeriodIsoRange(jYear, 1)[0]
  const yearEnd   = etsPeriodIsoRange(jYear, 12)[1]

  const { data: entries, isLoading } = useQuery({
    queryKey: ['performance', selectedUserId, jYear],
    queryFn: () => calendarService.getUserMonth(selectedUserId, yearStart, yearEnd).then(r => r.data),
    enabled: !!selectedUserId,
  })

  const selectedUser = selectableUsers.find(u => u.id === selectedUserId)
  // Only a SUPERVISOR can approve/reject, and only for their own direct reports
  const canApproveSelected = me?.role === 'SUPERVISOR' && selectedUser?.supervisor_id === me.id

  const approveMutation = useMutation({
    mutationFn: ({ date, status, minutes }: { date: string; status: ApprovalStatus; minutes: number | null }) =>
      calendarService.approveDay(selectedUserId, date, status, minutes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['performance', selectedUserId, jYear] }),
  })

  const clearApprovalMutation = useMutation({
    mutationFn: (date: string) => calendarService.clearApproval(selectedUserId, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['performance', selectedUserId, jYear] }),
  })

  function handleApprove(date: string, status: ApprovalStatus, minutes: number | null) {
    approveMutation.mutate({ date, status, minutes })
    setCustomFor(null)
    setCustomMin('')
  }

  // Only REMOTE and LEAVE entries
  const filteredEntries = useMemo(
    () => (entries ?? []).filter(e => e.day_type === 'REMOTE' || e.day_type === 'LEAVE'),
    [entries]
  )

  const remoteCount  = filteredEntries.filter(e => e.day_type === 'REMOTE').length
  const leaveCount   = filteredEntries.filter(e => e.day_type === 'LEAVE').length
  const approvedCount = filteredEntries.filter(e => e.approval_status === 'APPROVED').length

  // Group entries by ETS period (named after the period end-month, 1-12)
  const byMonth = useMemo(() => {
    const map = new Map<number, DayEntry[]>()
    for (const e of filteredEntries) {
      const [jy, jm, jd] = isoToJalali(e.date)
      const [periodY, periodM] = etsPeriodOf(jy, jm, jd)
      if (periodY !== jYear) continue
      if (!map.has(periodM)) map.set(periodM, [])
      map.get(periodM)!.push(e)
    }
    return map
  }, [filteredEntries, jYear])

  function fmtDate(iso: string) {
    const [jy, jm, jd] = isoToJalali(iso)
    const monthName = locale === 'fa' ? JALALI_MONTHS[jm - 1] : JALALI_MONTHS_EN[jm - 1]
    return locale === 'fa' ? `${jd} ${monthName} ${jy}` : `${monthName} ${jd}, ${jy}`
  }

  function formatHours(min: number) {
    const h = min / 60
    return locale === 'fa' ? `${h} ساعت` : `${h}h`
  }

  function fmtApproved(e: DayEntry) {
    if (!e.approved_minutes) return ''
    return ` (${formatHours(e.approved_minutes)})`
  }

  if (!hydrated || !me) return null

  if (me.role !== 'MANAGER' && me.role !== 'SUPERVISOR') {
    if (typeof window !== 'undefined') router.replace('/dashboard')
    return null
  }

  const currentYear  = todayJalali()[0]
  const yearOptions  = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i)

  return (
    <AppLayout>
      <div dir="rtl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-lg font-bold text-gray-800 dark:text-slate-100">{t('performance')}</h1>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('select_user')}:</span>
            <select
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">{t('select_user')}</option>
              {selectableUsers.map(u => (
                <option key={u.id} value={u.id} className={ROLE_TEXT_COLOR[u.role]}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('year')}:</span>
            <select
              value={jYear}
              onChange={e => setJYear(Number(e.target.value))}
              className="text-sm border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-1.5 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {!selectedUserId ? (
          <div className="text-center py-16 text-gray-400 dark:text-slate-500">
            <p className="text-4xl mb-3">👤</p>
            <p>{t('no_user_selected')}</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-slate-700 rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* User header */}
            <div className="mb-4">
              <h2 className="text-base font-semibold">
                <span className={selectedUser ? ROLE_TEXT_COLOR[selectedUser.role] : 'text-gray-800 dark:text-slate-100'}>
                  {selectedUser?.full_name}
                </span>
                <span className="text-xs font-normal text-gray-400 dark:text-slate-500 mr-2">
                  — {locale === 'fa' ? `دوره‌های ETS ${jYear} (۲۴ تا ۲۳)` : `ETS periods ${jYear} (24→23)`}
                </span>
              </h2>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard value={remoteCount}   label={t('remote_days')}   color="text-blue-600 dark:text-blue-400" />
              <StatCard value={leaveCount}    label={t('leave_days')}    color="text-red-500 dark:text-red-400" />
              <StatCard value={approvedCount} label={t('approved_count')} color="text-green-600 dark:text-green-400" />
            </div>

            {/* Month-by-month breakdown */}
            {filteredEntries.length === 0 ? (
              <div className="text-center py-10 text-gray-400 dark:text-slate-500 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
                <p>{t('no_entries')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Array.from({ length: 12 }, (_, i) => i + 1)
                  .filter(m => byMonth.has(m))
                  .map(m => {
                    const monthEntries = byMonth.get(m)!
                    const monthName = locale === 'fa' ? JALALI_MONTHS[m - 1] : JALALI_MONTHS_EN[m - 1]
                    const remoteInMonth = monthEntries.filter(e => e.day_type === 'REMOTE').length
                    const leaveInMonth  = monthEntries.filter(e => e.day_type === 'LEAVE').length
                    return (
                      <div key={m} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        {/* Month header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-700/50">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">
                            {locale === 'fa' ? 'دوره' : 'Period'} {monthName} {jYear}
                          </h3>
                          <div className="flex gap-2 text-xs">
                            {remoteInMonth > 0 && (
                              <span className="text-blue-600 dark:text-blue-400 font-medium">{remoteInMonth} ریموت</span>
                            )}
                            {leaveInMonth > 0 && (
                              <span className="text-red-500 dark:text-red-400 font-medium">{leaveInMonth} مرخصی</span>
                            )}
                          </div>
                        </div>

                        {/* Entries list */}
                        <ul className="divide-y divide-gray-50 dark:divide-slate-700/50">
                          {monthEntries
                            .sort((a, b) => a.date.localeCompare(b.date))
                            .map(e => {
                              const cfg = TYPE_BADGE[e.day_type as DayType]
                              const appr = e.approval_status as ApprovalStatus | null
                              const isCustomOpen = customFor === e.date
                              return (
                                <li key={e.date} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                                  <span className="text-sm text-gray-700 dark:text-slate-300 font-medium min-w-[120px]">
                                    {fmtDate(e.date)}
                                  </span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${cfg.cls}`}>
                                    {locale === 'fa' ? cfg.label.fa : cfg.label.en}
                                  </span>
                                  {e.day_type === 'REMOTE' && !canApproveSelected && (
                                    appr ? (
                                      <span className={`text-[11px] font-semibold ${APPROVAL_BADGE[appr].cls}`}>
                                        {APPROVAL_BADGE[appr].icon}
                                        {appr === 'APPROVED' ? t('approved') : t('rejected_work')}
                                        {appr === 'APPROVED' ? fmtApproved(e) : ''}
                                      </span>
                                    ) : (
                                      <span className="text-[11px] text-gray-400 dark:text-slate-500">{t('pending_approval')}</span>
                                    )
                                  )}

                                  {/* Approve/reject controls — SUPERVISOR, own direct reports only */}
                                  {e.day_type === 'REMOTE' && canApproveSelected && (
                                    appr ? (
                                      <div className="flex items-center gap-2">
                                        <span className={`text-[11px] font-semibold ${APPROVAL_BADGE[appr].cls}`}>
                                          {APPROVAL_BADGE[appr].icon}
                                          {appr === 'APPROVED' ? t('approved') : t('rejected_work')}
                                          {appr === 'APPROVED' ? fmtApproved(e) : ''}
                                        </span>
                                        <button
                                          disabled={clearApprovalMutation.isPending}
                                          onClick={() => clearApprovalMutation.mutate(e.date)}
                                          title={t('clear_approval')}
                                          className="text-[10px] px-1.5 py-0.5 rounded text-gray-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : isCustomOpen ? (
                                      <div className="flex items-center gap-1.5">
                                        <select
                                          value={customMin}
                                          onChange={ev => setCustomMin(ev.target.value)}
                                          className="text-xs border border-gray-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                                        >
                                          <option value="">{t('select_hours')}</option>
                                          {HALF_HOUR_OPTIONS.map(min => (
                                            <option key={min} value={min}>{formatHours(min)}</option>
                                          ))}
                                        </select>
                                        <button
                                          disabled={!customMin || approveMutation.isPending}
                                          onClick={() => handleApprove(e.date, 'APPROVED', parseInt(customMin))}
                                          className="text-xs px-2 py-1 bg-green-600 dark:bg-green-700 text-white rounded disabled:opacity-50"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={() => { setCustomFor(null); setCustomMin('') }}
                                          className="text-xs px-1.5 py-1 text-gray-400 dark:text-slate-500 hover:text-gray-600"
                                        >
                                          ✕
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <button
                                          disabled={approveMutation.isPending}
                                          onClick={() => handleApprove(e.date, 'APPROVED', null)}
                                          className="text-[11px] px-2 py-1 rounded font-medium bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/50 disabled:opacity-50"
                                        >
                                          ✓ {t('approve_all')}
                                        </button>
                                        <button
                                          disabled={approveMutation.isPending}
                                          onClick={() => setCustomFor(e.date)}
                                          className="text-[11px] px-2 py-1 rounded font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 disabled:opacity-50"
                                        >
                                          ✎ {t('approve_custom')}
                                        </button>
                                        <button
                                          disabled={approveMutation.isPending}
                                          onClick={() => handleApprove(e.date, 'REJECTED', null)}
                                          className="text-[11px] px-2 py-1 rounded font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 disabled:opacity-50"
                                        >
                                          ✗ {t('reject_work')}
                                        </button>
                                      </div>
                                    )
                                  )}
                                </li>
                              )
                            })}
                        </ul>
                      </div>
                    )
                  })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  )
}
