'use client'

import { useEffect, useRef, useState } from 'react'
import { calendarService } from '@/services/calendar.service'
import { useT } from '@/hooks/useT'

interface Props {
  userId: string
  isoDate: string
  initialNotes: string | null
  onSaved?: () => void
}

export function DayNotesEditor({ userId, isoDate, initialNotes, onSaved }: Props) {
  const t = useT()
  const [text, setText] = useState(initialNotes ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setText(initialNotes ?? '')
    setSaveStatus('idle')
  }, [userId, isoDate, initialNotes])

  async function persist(value: string) {
    setSaveStatus('saving')
    try {
      await calendarService.setNotes(userId, isoDate, value.trim() || null)
      setSaveStatus('saved')
      onSaved?.()
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('idle')
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setText(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => persist(value), 1400)
  }

  function handleBlur() {
    if (timerRef.current) clearTimeout(timerRef.current)
    persist(text)
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wide flex items-center gap-1">
          📋 {t('day_notes_hint')}
        </span>
        {saveStatus === 'saving' && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 animate-pulse">{t('saving')}</span>
        )}
        {saveStatus === 'saved' && (
          <span className="text-[10px] text-green-500 dark:text-green-400">{t('saved')}</span>
        )}
      </div>
      <textarea
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={t('day_notes_placeholder')}
        rows={4}
        dir="rtl"
        className="w-full text-xs border border-indigo-100 dark:border-indigo-900/50 rounded-lg px-2.5 py-2 bg-indigo-50/40 dark:bg-indigo-950/20 text-gray-700 dark:text-slate-300 placeholder-gray-300 dark:placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-indigo-700 leading-relaxed"
      />
    </div>
  )
}
