'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportService } from '@/services/report.service'
import { useT } from '@/hooks/useT'

export function ReportCard() {
  const t = useT()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const { data: report, isLoading } = useQuery({
    queryKey: ['report-today'],
    queryFn: () => reportService.getToday().then((r) => r.data),
  })

  useEffect(() => {
    if (report) setText(report.today_text)
  }, [report])

  const mutation = useMutation({
    mutationFn: () =>
      reportService.upsertToday({ today_text: text, blockers_text: '', tomorrow_text: '' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['report-today'] })
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 2000)
    },
  })

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const insert = '\n• '
    const next = text.slice(0, start) + insert + text.slice(end)
    setText(next)
    requestAnimationFrame(() => {
      ta.selectionStart = ta.selectionEnd = start + insert.length
    })
  }

  if (isLoading) return <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 p-6 animate-pulse h-40 w-full max-w-lg" />

  const savedAt = report?.updated_at
    ? new Date(report.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-6 w-full max-w-lg">
      <h2 className="font-medium text-gray-700 dark:text-slate-300 mb-3">{t('daily_report')}</h2>
      <textarea
        ref={taRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t('report_placeholder')}
        rows={6}
        className="w-full border border-gray-200 dark:border-slate-600 rounded-md px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 dark:focus:ring-slate-500 text-gray-700 dark:text-slate-200 bg-white dark:bg-slate-700 placeholder-gray-300 dark:placeholder-slate-500 font-mono leading-6"
      />
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-gray-400 dark:text-slate-500">
          {savedAt ? `${t('last_saved')} ${savedAt}` : t('not_saved')}
        </span>
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="bg-gray-900 dark:bg-slate-600 text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-gray-700 dark:hover:bg-slate-500 disabled:opacity-50 transition-colors min-w-[72px]"
        >
          {justSaved ? t('saved') : mutation.isPending ? t('saving') : t('save')}
        </button>
      </div>
    </div>
  )
}
