'use client'

import { useQuery } from '@tanstack/react-query'
import { userService } from '@/services/user.service'
import { statusService } from '@/services/status.service'
import type { Role, StatusState, User, UserStatus } from '@/types'

const STATUS_DOT: Record<StatusState, string> = {
  AVAILABLE: 'bg-green-500',
  OFFLINE: 'bg-gray-300',
  BREAK: 'bg-yellow-400',
  FOCUS: 'bg-blue-500',
  MEETING: 'bg-purple-500',
}

const STATUS_LABEL: Record<StatusState, string> = {
  AVAILABLE: 'Available',
  OFFLINE: 'Offline',
  BREAK: 'Break',
  FOCUS: 'Focus',
  MEETING: 'Meeting',
}

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: 'bg-red-100 text-red-700',
  MANAGER: 'bg-orange-100 text-orange-700',
  SUPERVISOR: 'bg-blue-100 text-blue-700',
  MEMBER: 'bg-gray-100 text-gray-600',
}

const STATUS_ORDER: StatusState[] = ['AVAILABLE', 'FOCUS', 'MEETING', 'BREAK', 'OFFLINE']

export function PresenceBoard() {
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => userService.list().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const { data: statuses, isLoading: statusLoading } = useQuery({
    queryKey: ['all-statuses'],
    queryFn: () => statusService.getAll().then((r) => r.data),
    refetchInterval: 30_000,
  })

  if (usersLoading || statusLoading) {
    return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Array(6).fill(0).map((_, i) => <div key={i} className="bg-white rounded-lg border p-4 h-20 animate-pulse" />)}</div>
  }

  const statusMap = new Map<string, UserStatus>(
    (statuses ?? []).map((s) => [s.user_id, s])
  )

  const enriched = (users ?? []).map((u) => ({
    ...u,
    status: (statusMap.get(u.id)?.status ?? 'OFFLINE') as StatusState,
    updated_at: statusMap.get(u.id)?.updated_at ?? null,
  }))

  const sorted = [...enriched].sort(
    (a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  )

  const byStatus = STATUS_ORDER.reduce<Record<StatusState, typeof sorted[0][]>>(
    (acc, s) => { acc[s] = sorted.filter((u) => u.status === s); return acc },
    {} as any
  )

  return (
    <div className="space-y-6">
      {STATUS_ORDER.map((status) => {
        const group = byStatus[status]
        if (!group.length) return null
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
              <h3 className="text-sm font-semibold text-gray-600">{STATUS_LABEL[status]}</h3>
              <span className="text-xs text-gray-400">({group.length})</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {group.map((u) => (
                <div key={u.id} className="bg-white rounded-lg border px-4 py-3 flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[u.status]}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.full_name}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}
      {!users?.length && (
        <p className="text-gray-400 text-sm">No team members found</p>
      )}
    </div>
  )
}
