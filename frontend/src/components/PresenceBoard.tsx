'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import { statusService } from '@/services/status.service'
import { workService } from '@/services/work.service'
import { UserPanel } from '@/components/UserPanel'
import { useAuthStore } from '@/store/auth.store'
import { useSSEStore } from '@/store/sse.store'
import { useT } from '@/hooks/useT'
import type { PingResultData, Role, StatusState, User } from '@/types'

const STATUS_DOT: Record<StatusState, string> = {
  AVAILABLE: 'bg-green-500',
  OFFLINE:   'bg-gray-300 dark:bg-slate-600',
  FOCUS:     'bg-blue-500',
  BREAK:     'bg-yellow-400',
  MEETING:   'bg-purple-500',
}

const STATUS_KEY: Record<StatusState, 'available' | 'offline' | 'focus' | 'break_' | 'meeting'> = {
  AVAILABLE: 'available', OFFLINE: 'offline', FOCUS: 'focus', BREAK: 'break_', MEETING: 'meeting',
}

const TAG_BADGE: Record<StatusState, string> = {
  AVAILABLE: '', OFFLINE: '',
  FOCUS:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  BREAK:   'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  MEETING: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN:      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  MANAGER:    'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  SUPERVISOR: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  MEMBER:     'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400',
}

const STATUS_ORDER: StatusState[] = ['AVAILABLE', 'FOCUS', 'MEETING', 'BREAK', 'OFFLINE']

// ── Ping modal ────────────────────────────────────────────────────────────────
interface PingModalProps {
  target: User & { status: StatusState }
  onClose: () => void
}

function PingModal({ target, onClose }: PingModalProps) {
  const t = useT()
  const { pingResult, setPingResult } = useSSEStore()
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  // Auto-close when a confirmation arrives
  useEffect(() => {
    if (sent && pingResult && pingResult.target_user_id === target.id) {
      onClose()
    }
  }, [pingResult, sent, target.id, onClose])

  async function send() {
    setSending(true)
    try {
      await statusService.sendPing(target.id, message.trim())
      setSent(true)
    } catch {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4 border border-gray-200 dark:border-slate-700">
        {sent ? (
          <div className="text-center py-2">
            <p className="text-4xl mb-3 animate-pulse">📡</p>
            <p className="font-semibold text-gray-800 dark:text-slate-100 mb-1">{t('ping_waiting')}</p>
            <p className="text-sm text-gray-400 dark:text-slate-500">{target.full_name}</p>
            <button onClick={onClose} className="mt-5 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">بستن</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-gray-800 dark:text-slate-100 text-sm">{t('ping_send')}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500">{target.full_name}</p>
              </div>
              <span className="text-2xl">🔔</span>
            </div>

            <textarea
              ref={inputRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('ping_message_placeholder')}
              rows={3}
              className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-600 mb-4"
            />

            <div className="flex gap-2">
              <button
                onClick={send}
                disabled={sending}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                {sending ? t('ping_sending') : `🔔 ${t('ping_send')}`}
              </button>
              <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                انصراف
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Ping result toast ─────────────────────────────────────────────────────────
function PingResultToast({ result, onDismiss }: { result: PingResultData; onDismiss: () => void }) {
  const t = useT()
  useEffect(() => {
    const id = setTimeout(onDismiss, 6000)
    return () => clearTimeout(id)
  }, [result.check_id, onDismiss])

  return (
    <div
      dir="rtl"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-sm w-full mx-4 bg-green-50 dark:bg-green-900/40 border border-green-200 dark:border-green-700 rounded-2xl shadow-xl px-5 py-4"
    >
      <div className="flex items-start gap-3">
        <span className="text-xl shrink-0">✅</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-green-800 dark:text-green-300">
            <span className="font-bold">{result.target_name}</span>{' '}{t('ping_confirmed')}
          </p>
          {result.reply_message && (
            <p className="text-xs text-green-700 dark:text-green-400 mt-1 leading-relaxed">{result.reply_message}</p>
          )}
        </div>
        <button onClick={onDismiss} className="text-xs text-green-600 dark:text-green-500 opacity-60 hover:opacity-100 shrink-0">✕</button>
      </div>
    </div>
  )
}

// ── Main board ────────────────────────────────────────────────────────────────
export function PresenceBoard() {
  const t = useT()
  const { user: me } = useAuthStore()
  const { statusMap, connected, pingResult, setPingResult } = useSSEStore()
  const qc = useQueryClient()
  const [panelUser, setPanelUser] = useState<(User & { status: StatusState }) | null>(null)
  const [pingTarget, setPingTarget] = useState<(User & { status: StatusState }) | null>(null)
  const [sessionConfirm, setSessionConfirm] = useState<{ user: User & { status: StatusState }; action: 'start' | 'end' } | null>(null)

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list().then(r => r.data),
    refetchInterval: 60_000,
  })

  const sessionMutation = useMutation({
    mutationFn: ({ userId, action }: { userId: string; action: 'start' | 'end' }) =>
      action === 'start' ? workService.startFor(userId) : workService.endFor(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setSessionConfirm(null)
    },
  })

  const canOpenPanel = me?.role === 'MANAGER' || me?.role === 'SUPERVISOR'

  function canPingUser(u: User): boolean {
    if (!me || u.id === me.id) return false
    if (me.role === 'MANAGER') return true
    if (me.role === 'SUPERVISOR') return u.supervisor_id === me.id
    return false
  }

  function canControlSession(u: User): boolean {
    if (!me || u.id === me.id) return false
    if (me.role === 'ADMIN' || me.role === 'MANAGER') return true
    if (me.role === 'SUPERVISOR') return u.supervisor_id === me.id
    return false
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-4 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const enriched = (users ?? []).map(u => ({
    ...u,
    status: (statusMap[u.id]?.status ?? 'OFFLINE') as StatusState,
  }))

  const sorted = [...enriched].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status))
  const byStatus = STATUS_ORDER.reduce<Record<StatusState, typeof sorted>>((acc, s) => {
    acc[s] = sorted.filter(u => u.status === s)
    return acc
  }, {} as Record<StatusState, typeof sorted>)

  return (
    <>
      {panelUser && me && (
        <UserPanel user={panelUser} viewerRole={me.role} onClose={() => setPanelUser(null)} />
      )}
      {pingTarget && (
        <PingModal target={pingTarget} onClose={() => setPingTarget(null)} />
      )}
      {pingResult && (
        <PingResultToast result={pingResult} onDismiss={() => setPingResult(null)} />
      )}

      {/* Session control confirm modal */}
      {sessionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" dir="rtl">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-6 max-w-xs w-full mx-4 border border-gray-200 dark:border-slate-700">
            <p className="font-semibold text-gray-800 dark:text-slate-100 text-sm mb-1">
              {sessionConfirm.action === 'start' ? t('confirm_start_for') : t('confirm_end_for')}
            </p>
            <p className="text-xs text-gray-400 dark:text-slate-500 mb-5">{sessionConfirm.user.full_name}</p>
            <div className="flex gap-2">
              <button
                onClick={() => sessionMutation.mutate({ userId: sessionConfirm.user.id, action: sessionConfirm.action })}
                disabled={sessionMutation.isPending}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                  sessionConfirm.action === 'start'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {sessionMutation.isPending ? t('loading') : t('confirm')}
              </button>
              <button
                onClick={() => setSessionConfirm(null)}
                className="px-4 py-2.5 text-sm text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {!connected && (
          <p className="text-xs text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 px-3 py-1.5 rounded-lg inline-block">
            {t('connecting')}
          </p>
        )}

        {STATUS_ORDER.map(status => {
          const group = byStatus[status]
          if (!group.length) return null
          return (
            <div key={status}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
                <h3 className="text-sm font-semibold text-gray-600 dark:text-slate-400">{t(STATUS_KEY[status])}</h3>
                <span className="text-xs text-gray-400 dark:text-slate-500">({group.length})</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.map(u => {
                  const pingable = canPingUser(u) && u.status !== 'OFFLINE'
                  const controllable = canControlSession(u)
                  const isOffline = u.status === 'OFFLINE'
                  return (
                    <div
                      key={u.id}
                      onClick={() => canOpenPanel && setPanelUser(u)}
                      className={`relative group bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3 transition-colors ${
                        canOpenPanel ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10' : ''
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{u.full_name}</p>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                          {TAG_BADGE[u.status] && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TAG_BADGE[u.status]}`}>{t(STATUS_KEY[u.status])}</span>
                          )}
                        </div>
                      </div>

                      {/* Action buttons — visible on hover */}
                      <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        {pingable && (
                          <button
                            onClick={e => { e.stopPropagation(); setPingTarget(u) }}
                            title={t('ping_send')}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/70 transition-colors text-sm shadow-sm"
                          >
                            🔔
                          </button>
                        )}
                        {controllable && (
                          <button
                            onClick={e => { e.stopPropagation(); setSessionConfirm({ user: u, action: isOffline ? 'start' : 'end' }) }}
                            title={isOffline ? t('start_work_for') : t('end_work_for')}
                            className={`w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold shadow-sm transition-colors ${
                              isOffline
                                ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/60'
                                : 'bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60'
                            }`}
                          >
                            {isOffline ? '▶' : '■'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {!users?.length && <p className="text-gray-400 dark:text-slate-500 text-sm">{t('no_users')}</p>}
      </div>
    </>
  )
}
