'use client'

import { useEffect, useState } from 'react'
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
  // what is currently saved on the server
  const [savedText, setSavedText] = useState(initialNotes ?? '')
  // what is in the textarea right now
  const [text, setText] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  // sync when parent switches day or user
  useEffect(() => {
    setSavedText(initialNotes ?? '')
    setText(initialNotes ?? '')
    setJustSaved(false)
  }, [userId, isoDate, initialNotes])

  const isDirty = text !== savedText

  async function handleSave() {
    setSaving(true)
    try {
      await calendarService.setNotes(userId, isoDate, text.trim() || null)
      setSavedText(text)
      setJustSaved(true)
      onSaved?.()
      setTimeout(() => setJustSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-gray-100 dark:border-slate-700">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-indigo-400 dark:text-indigo-500 uppercase tracking-wide flex items-center gap-1">
          📋 {t('day_notes_hint')}
        </span>
        {justSaved && !isDirty && (
          <span className="text-[10px] text-green-500 dark:text-green-400">{t('saved')}</span>
        )}
      </div>

      <textarea
        value={text}
        onChange={e => { setText(e.target.value); setJustSaved(false) }}
        placeholder={t('day_notes_placeholder')}
        rows={4}
        dir="rtl"
        className="w-full text-xs border border-indigo-100 dark:border-indigo-900/50 rounded-lg px-2.5 py-2 bg-indigo-50/40 dark:bg-indigo-950/20 text-gray-700 dark:text-slate-300 placeholder-gray-300 dark:placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-indigo-700 leading-relaxed"
      />

      {isDirty && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-1.5 w-full py-1.5 rounded-lg text-[11px] font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white transition-colors"
        >
          {saving ? t('saving') : t('save')}
        </button>
      )}
    </div>
  )
}
