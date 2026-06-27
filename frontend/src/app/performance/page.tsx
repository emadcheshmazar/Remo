'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { calendarService } from '@/services/calendar.service'
import { jalaliMonthIsoRange, isoToJalali, JALALI_MONTHS, todayJalali } from '@/utils/jalali'
import { useT } from '@/hooks/useT'
import { useLocaleStore } from '@/store/locale.store'
import type { ApprovalStatus, DayEntry, DayType } from '@/types'

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
  const t = useT()
  const { locale } = useLocaleStore()

  const [jYear, setJYear] = useState(todayJalali()[0])
  const [selectedUserId, setSelectedUserId] = useState('')

  const { data: users } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: () => calendarService.getCalendarUsers().then(r => r.data),
    enabled: !!me,
  })

  const yearStart = jalaliMonthIsoRange(jYear, 1)[0]
  const yearEnd   = jalaliMonthIsoRange(jYear, 12)[1]

  const { data: entries, isLoading } = useQuery({
    queryKey: ['performance', selectedUserId, jYear],
    queryFn: () => calendarService.getUserMonth(selectedUserId, yearStart, yearEnd).then(r => r.data),
    enabled: !!selectedUserId,
  })

  const selectedUser = users?.find(u => u.id === selectedUserId)

  // Only REMOTE and LEAVE entries
  const filteredEntries = useMemo(
    () => (entries ?? []).filter(e => e.day_type === 'REMOTE' || e.day_type === 'LEAVE'),
    [entries]
  )

  const remoteCount  = filteredEntries.filter(e => e.day_type === 'REMOTE').length
  const leaveCount   = filteredEntries.filter(e => e.day_type === 'LEAVE').length
  const approvedCount = filteredEntries.filter(e => e.approval_status === 'APPROVED').length

  // Group entries by Jalali month (1-12)
  const byMonth = useMemo(() => {
    const map = new Map<number, DayEntry[]>()
    for (const e of filteredEntries) {
      const [, jm] = isoToJalali(e.date)
      if (!map.has(jm)) map.set(jm, [])
      map.get(jm)!.push(e)
    }
    return map
  }, [filteredEntries])

  function fmtDate(iso: string) {
    const [jy, jm, jd] = isoToJalali(iso)
    const monthName = locale === 'fa' ? JALALI_MONTHS[jm - 1] : JALALI_MONTHS_EN[jm - 1]
    return locale === 'fa' ? `${jd} ${monthName} ${jy}` : `${monthName} ${jd}, ${jy}`
  }

  function fmtApproved(e: DayEntry) {
    if (!e.approved_minutes) return ''
    const h = e.approved_minutes / 60
    return locale === 'fa' ? ` (${h} ساعت)` : ` (${h}h)`
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
              {(users ?? []).map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
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
              <h2 className="text-base font-semibold text-gray-800 dark:text-slate-100">
                {selectedUser?.full_name}
                <span className="text-xs font-normal text-gray-400 dark:text-slate-500 mr-2">
                  — {locale === 'fa' ? JALALI_MONTHS[0] : JALALI_MONTHS_EN[0]} {jYear} تا {locale === 'fa' ? JALALI_MONTHS[11] : JALALI_MONTHS_EN[11]} {jYear}
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
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{monthName} {jYear}</h3>
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
                              return (
                                <li key={e.date} className="flex items-center gap-3 px-4 py-2.5">
                                  <span className="text-sm text-gray-700 dark:text-slate-300 font-medium min-w-[120px]">
                                    {fmtDate(e.date)}
                                  </span>
                                  <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${cfg.cls}`}>
                                    {locale === 'fa' ? cfg.label.fa : cfg.label.en}
                                  </span>
                                  {e.day_type === 'REMOTE' && (
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
