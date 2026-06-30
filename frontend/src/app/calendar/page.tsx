'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'
import { AppLayout } from '@/components/AppLayout'
import { JalaliCalendar, DayMeta } from '@/components/JalaliCalendar'
import { DayDetail } from '@/components/DayDetail'
import { DayNotesEditor } from '@/components/DayNotesEditor'
import { calendarService } from '@/services/calendar.service'
import { todayJalali, jalaliToIso, formatJalali, isoToJalali, jalaliMonthIsoRange } from '@/utils/jalali'
import { useT } from '@/hooks/useT'
import type { ApprovalStatus, DayEntry, DayType, User } from '@/types'

const TYPE_DOT: Record<DayType, string> = { REMOTE: 'bg-blue-500', LEAVE: 'bg-red-400' }
const TYPE_BADGE: Record<DayType, string> = {
  REMOTE: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700',
  LEAVE:  'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-700',
}
const APPROVAL_BADGE: Record<ApprovalStatus, string> = {
  APPROVED: 'text-green-600 dark:text-green-400',
  REJECTED: 'text-red-500 dark:text-red-400',
}

function CalendarContent() {
  const { user: me, hydrated } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const qc = useQueryClient()
  const t = useT()

  const [todayJy, todayJm] = todayJalali()
  const [jy, setJy] = useState(todayJy)
  const [jm, setJm] = useState(todayJm)
  const todayIso = jalaliToIso(...todayJalali())
  const [selectedIso, setSelectedIso] = useState<string>(todayIso)

  const [filterSupervisorId, setFilterSupervisorId] = useState<string>('')
  const [filterUserId, setFilterUserId] = useState<string>(searchParams.get('user_id') ?? '')

  useEffect(() => {
    if (!hydrated) return
    if (!me) router.push('/login')
    else if (me.role === 'ADMIN') router.push('/admin')
  }, [me, hydrated, router])

  const canFilter = me?.role === 'MANAGER' || me?.role === 'SUPERVISOR'
  const canEdit   = me?.role === 'MANAGER' || me?.role === 'SUPERVISOR'

  // Who can see the full day detail (stats, timeline, report, approval status)?
  // MANAGER: everyone; SUPERVISOR: own team + self; MEMBER: only self
  function canViewDetailFor(u: User): boolean {
    if (!me) return false
    if (me.role === 'MANAGER') return true
    if (me.role === 'SUPERVISOR') return u.id === me.id || u.supervisor_id === me.id
    return u.id === me.id
  }

  // Who can approve/reject/clear? Only SUPERVISOR for their direct team
  function canApproveFor(u: User): boolean {
    if (!me) return false
    return me.role === 'SUPERVISOR' && u.supervisor_id === me.id
  }

  // Compute the full Jalali month ISO range (fixes cross-Gregorian-month boundary)
  const [monthStart, monthEnd] = useMemo(() => jalaliMonthIsoRange(jy, jm), [jy, jm])

  const { data: teamEntries } = useQuery({
    queryKey: ['calendar-team', jy, jm],
    queryFn: () => calendarService.getTeamMonth(monthStart, monthEnd).then(r => r.data),
    enabled: !!me && me.role !== 'ADMIN',
  })

  const { data: users } = useQuery({
    queryKey: ['calendar-users'],
    queryFn: () => calendarService.getCalendarUsers().then(r => r.data),
    enabled: !!me && me.role !== 'ADMIN',
  })

  const supervisors = useMemo(
    () => (users ?? []).filter(u => u.role === 'SUPERVISOR'),
    [users]
  )

  const effectiveEntries = useMemo(() => {
    let entries = teamEntries ?? []
    if (filterUserId) entries = entries.filter(e => e.user_id === filterUserId)
    else if (filterSupervisorId) {
      const teamIds = new Set(
        (users ?? []).filter(u => u.supervisor_id === filterSupervisorId || u.id === filterSupervisorId).map(u => u.id)
      )
      entries = entries.filter(e => teamIds.has(e.user_id))
    }
    return entries
  }, [teamEntries, filterUserId, filterSupervisorId, users])

  const userMap = useMemo(() => new Map((users ?? []).map(u => [u.id, u])), [users])

  const daysMeta = useMemo<Record<string, DayMeta>>(() => {
    const map: Record<string, DayMeta> = {}
    for (const e of effectiveEntries) {
      if (!map[e.date]) map[e.date] = { users: [] }
      const name = userMap.get(e.user_id)?.full_name ?? me?.full_name ?? '?'
      map[e.date].users.push({ id: e.user_id, name, day_type: e.day_type })
    }
    return map
  }, [effectiveEntries, userMap, me])

  const visibleUsers = useMemo<User[]>(() => {
    let list = users ?? []
    if (filterUserId) list = list.filter(u => u.id === filterUserId)
    else if (filterSupervisorId) list = list.filter(u => u.supervisor_id === filterSupervisorId || u.id === filterSupervisorId)
    if (!list.length && me) {
      list = [{ id: me.id, username: me.username, full_name: me.full_name, role: me.role, is_active: true, supervisor_id: null, created_at: '' }]
    }
    return list
  }, [users, filterUserId, filterSupervisorId, me])

  // Map of userId → full DayEntry for the selected date (includes approval info)
  const dayEntryForDate = useMemo(() => {
    const m = new Map<string, DayEntry>()
    for (const e of effectiveEntries) {
      if (e.date === selectedIso) m.set(e.user_id, e)
    }
    return m
  }, [effectiveEntries, selectedIso])

  const [detailUserId, setDetailUserId] = useState<string | null>(null)
  useEffect(() => { setDetailUserId(null) }, [selectedIso])

  const setMutation = useMutation({
    mutationFn: ({ userId, dt }: { userId: string; dt: DayType | null }) =>
      dt
        ? calendarService.setDayType(userId, selectedIso, dt)
        : calendarService.clearDay(userId, selectedIso),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['calendar-team'] }),
  })

  const [jSelY, jSelM, jSelD] = isoToJalali(selectedIso)

  if (!hydrated || !me || me.role === 'ADMIN') return null

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-bold text-gray-800 dark:text-slate-100">{t('team_calendar')}</h1>
        <button
          onClick={() => { setJy(todayJy); setJm(todayJm); setSelectedIso(todayIso) }}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 font-medium"
        >
          {t('go_to_today')}
        </button>
      </div>

      {canFilter && (
        <div className="flex items-center gap-3 mb-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 shadow-sm flex-wrap">
          <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">{t('filter')}:</span>

          {supervisors.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-gray-500 dark:text-slate-400">{t('supervisor_filter')}:</span>
              <select
                value={filterSupervisorId}
                onChange={e => { setFilterSupervisorId(e.target.value); setFilterUserId('') }}
                className="text-xs border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">{t('all')}</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-500 dark:text-slate-400">{t('person_filter')}:</span>
            <select
              value={filterUserId}
              onChange={e => { setFilterUserId(e.target.value); setFilterSupervisorId('') }}
              className="text-xs border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1 bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">{t('all')}</option>
              {(users ?? []).map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>
          </div>

          {(filterSupervisorId || filterUserId) && (
            <button
              onClick={() => { setFilterSupervisorId(''); setFilterUserId('') }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
            >
              {t('clear_filter')}
            </button>
          )}
        </div>
      )}

      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
          <JalaliCalendar
            year={jy}
            month={jm}
            onMonthChange={(y, m) => { setJy(y); setJm(m) }}
            selectedDate={selectedIso}
            onDayClick={(iso) => setSelectedIso(iso)}
            days={daysMeta}
          />
        </div>

        {/* Day panel */}
        <div className="w-72 shrink-0 sticky top-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm p-4">
            <h2 className="text-sm font-bold text-gray-700 dark:text-slate-200 mb-3 pb-2 border-b border-gray-100 dark:border-slate-700">
              {formatJalali(jSelY, jSelM, jSelD)}
            </h2>

            {visibleUsers.length === 0 ? (
              <p className="text-xs text-gray-400 dark:text-slate-500">{t('no_users')}</p>
            ) : (
              <ul className="space-y-1.5 max-h-[70vh] overflow-y-auto">
                {visibleUsers.map((u) => {
                  const entry = dayEntryForDate.get(u.id) ?? null
                  const dt = entry?.day_type ?? null
                  const approval = entry?.approval_status as ApprovalStatus | null ?? null
                  const isOpen = detailUserId === u.id
                  const canViewThis = canViewDetailFor(u)
                  const canApproveThis = canApproveFor(u)
                  // When approved or rejected, set/clear buttons are locked
                  const isLocked = !!approval

                  return (
                    <li key={u.id} className="rounded-lg border border-gray-100 dark:border-slate-700 overflow-hidden">
                      {/* Row header — clickable only if viewer can see detail */}
                      <div
                        onClick={canViewThis ? () => setDetailUserId(isOpen ? null : u.id) : undefined}
                        className={`flex items-center gap-2 px-2.5 py-2 transition-colors ${
                          canViewThis ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50' : ''
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dt ? TYPE_DOT[dt] : 'bg-gray-200 dark:bg-slate-600'}`} />
                        <span className="flex-1 text-sm text-gray-700 dark:text-slate-300 font-medium truncate">{u.full_name}</span>
                        {dt && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${TYPE_BADGE[dt]}`}>
                            {t(dt === 'REMOTE' ? 'remote' : 'leave')}
                          </span>
                        )}
                        {/* Approval badge — only for viewers who can see detail */}
                        {approval && dt === 'REMOTE' && canViewThis && (
                          <span className={`text-[10px] font-semibold ${APPROVAL_BADGE[approval]}`}>
                            {approval === 'APPROVED' ? '✓' : '✗'}
                            {approval === 'APPROVED' && entry?.approved_minutes != null
                              ? ` ${entry.approved_minutes / 60}h`
                              : ''}
                          </span>
                        )}
                        {/* Expand chevron */}
                        {canViewThis && (
                          <span className="text-[10px] text-gray-300 dark:text-slate-600 shrink-0">
                            {isOpen ? '▲' : '▼'}
                          </span>
                        )}
                      </div>

                      {/* Set REMOTE/LEAVE buttons — only for editors who can view this user */}
                      {canEdit && canViewThis && (
                        <div className="px-2.5 pb-2 pt-0">
                          <div className="flex gap-1">
                            <button
                              disabled={setMutation.isPending || isLocked}
                              onClick={(e) => { e.stopPropagation(); setMutation.mutate({ userId: u.id, dt: 'REMOTE' }) }}
                              title={isLocked ? 'کارکرد تأیید شده — ابتدا تأیید را پاک کنید' : undefined}
                              className={`flex-1 text-[11px] py-1 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                dt === 'REMOTE' ? 'bg-blue-600 text-white' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                              }`}
                            >
                              {t('set_remote')}
                            </button>
                            <button
                              disabled={setMutation.isPending || isLocked}
                              onClick={(e) => { e.stopPropagation(); setMutation.mutate({ userId: u.id, dt: 'LEAVE' }) }}
                              title={isLocked ? 'کارکرد تأیید شده — ابتدا تأیید را پاک کنید' : undefined}
                              className={`flex-1 text-[11px] py-1 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                dt === 'LEAVE' ? 'bg-red-500 text-white' : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50'
                              }`}
                            >
                              {t('set_leave')}
                            </button>
                            {dt && (
                              <button
                                disabled={setMutation.isPending || isLocked}
                                onClick={(e) => { e.stopPropagation(); setMutation.mutate({ userId: u.id, dt: null }) }}
                                title={isLocked ? 'کارکرد تأیید شده — ابتدا تأیید را پاک کنید' : undefined}
                                className="px-2 text-[11px] py-1 rounded bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                ✕
                              </button>
                            )}
                          </div>

                          {/* Notes textarea — only for REMOTE entries */}
                          {dt === 'REMOTE' && (
                            <DayNotesEditor
                              userId={u.id}
                              isoDate={selectedIso}
                              initialNotes={entry?.notes ?? null}
                              onSaved={() => qc.invalidateQueries({ queryKey: ['calendar-team', jy, jm] })}
                            />
                          )}
                        </div>
                      )}

                      {/* Expanded detail — only for viewers who can see this user's detail */}
                      {canViewThis && isOpen && (
                        <div className="border-t border-gray-100 dark:border-slate-700 px-2.5 pb-2.5 pt-2">
                          <DayDetail
                            userId={u.id}
                            isoDate={selectedIso}
                            canEdit={false}
                            canViewDetail={true}
                            canApprove={canApproveThis}
                            onSetDayType={() => {}}
                            isPending={false}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default function CalendarPage() {
  return (
    <Suspense>
      <CalendarContent />
    </Suspense>
  )
}
