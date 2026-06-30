'use client'

import { useT } from '@/hooks/useT'

interface Props {
  notes: string
}

export function DayNotesCard({ notes }: Props) {
  const t = useT()

  const lines = notes
    .split('\n')
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => l.replace(/^[•\-*]\s*/, ''))

  if (!lines.length) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-indigo-100 dark:border-indigo-900/40 shadow-sm overflow-hidden flex-1 min-w-[260px]">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-center gap-2 border-b border-indigo-50 dark:border-indigo-900/30 bg-gradient-to-l from-indigo-50/60 to-transparent dark:from-indigo-950/30 dark:to-transparent">
        <span className="text-lg">📋</span>
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-200">{t('day_notes')}</h3>
      </div>

      {/* Lines */}
      <ul className="px-5 py-4 space-y-2.5" dir="rtl">
        {lines.map((line, i) => (
          <li key={i} className="flex items-start gap-3 group">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 dark:bg-indigo-500 shrink-0 mt-[7px] group-first:opacity-100" />
            <span className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">{line}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
