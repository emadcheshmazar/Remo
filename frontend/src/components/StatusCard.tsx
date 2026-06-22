'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { statusService } from '@/services/status.service'
import type { StatusState } from '@/types'

const LABELS: Record<StatusState, string> = {
  AVAILABLE: 'Available',
  OFFLINE: 'Offline',
  BREAK: 'Break',
  FOCUS: 'Focus',
  MEETING: 'Meeting',
}

const COLORS: Record<StatusState, string> = {
  AVAILABLE: 'bg-green-500',
  OFFLINE: 'bg-gray-400',
  BREAK: 'bg-yellow-400',
  FOCUS: 'bg-blue-500',
  MEETING: 'bg-purple-500',
}

const ALL: StatusState[] = ['AVAILABLE', 'BREAK', 'FOCUS', 'MEETING', 'OFFLINE']

export function StatusCard() {
  const qc = useQueryClient()

  const { data: myStatus, isLoading } = useQuery({
    queryKey: ['my-status'],
    queryFn: () => statusService.getMyStatus().then((r) => r.data),
    refetchInterval: 30_000,
  })

  const mutation = useMutation({
    mutationFn: (s: StatusState) => statusService.updateMyStatus(s),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-status'] }),
  })

  if (isLoading) return <div className="bg-white rounded-lg border p-6 h-40 animate-pulse" />

  const current: StatusState = myStatus?.status ?? 'OFFLINE'

  return (
    <div className="bg-white rounded-lg border p-6 w-full max-w-sm">
      <div className="flex items-center gap-2 mb-4">
        <span className={`w-2.5 h-2.5 rounded-full ${COLORS[current]}`} />
        <h2 className="font-medium text-gray-700">Status</h2>
        <span className="text-sm text-gray-500 ml-auto">{LABELS[current]}</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {ALL.map((s) => (
          <button
            key={s}
            onClick={() => mutation.mutate(s)}
            disabled={mutation.isPending || s === current}
            className={`flex items-center gap-2 py-1.5 px-3 rounded text-xs font-medium transition-colors disabled:cursor-default ${
              s === current
                ? 'ring-2 ring-offset-1 ring-gray-300 bg-gray-100 text-gray-700'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${COLORS[s]}`} />
            {LABELS[s]}
          </button>
        ))}
      </div>
    </div>
  )
}
