'use client'

import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'

export function ReportCard() {
  const qc = useQueryClient()
  const [todayText, setTodayText] = useState('')
  const [blockersText, setBlockersText] = useState('')
  const [tomorrowText, setTomorrowText] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-today'],
    queryFn: () => reportService.getToday().then((r) => r.data),
  })

  useEffect(() => {
    if (report) {
      setTodayText(report.today_text)
      setBlockersText(report.blockers_text)
      setTomorrowText(report.tomorrow_text)
    }
  }, [report])

  const mutation = useMutation({
    mutationFn: () =>
      reportService.upsertToday({
        today_text: todayText,
        blockers_text: blockersText,
        tomorrow_text: tomorrowText,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-today'] })
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    },
  })

  if (isLoading) return <div className="bg-white rounded-lg border p-6 animate-pulse h-64 w-full max-w-lg" />

  const savedAt = report?.updated_at
    ? new Date(report.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-white rounded-lg border p-6 w-full max-w-lg">
      <h2 className="font-medium text-gray-700 mb-4">Daily Report</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Today
          </label>
          <textarea
            value={todayText}
            onChange={(e) => setTodayText(e.target.value)}
            placeholder="What did you work on today?"
            rows={3}
            className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-700 placeholder-gray-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Blockers
          </label>
          <textarea
            value={blockersText}
            onChange={(e) => setBlockersText(e.target.value)}
            placeholder="Any blockers or issues?"
            rows={2}
            className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-700 placeholder-gray-300"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
            Tomorrow
          </label>
          <textarea
            value={tomorrowText}
            onChange={(e) => setTomorrowText(e.target.value)}
            placeholder="What's planned for tomorrow?"
            rows={2}
            className="w-full border rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 text-gray-700 placeholder-gray-300"
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-gray-400">
            {savedAt ? `Last saved ${savedAt}` : 'Not saved yet'}
          </span>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-gray-900 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-700 disabled:opacity-50 transition-colors min-w-[72px]"
          >
            {justSaved ? 'Saved ✓' : mutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
