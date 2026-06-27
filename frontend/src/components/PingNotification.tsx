'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSSEStore } from '@/store/sse.store'
import { statusService } from '@/services/status.service'
import { useT } from '@/hooks/useT'
import type { PingData } from '@/types'

const STORAGE_KEY = 'remo_pending_ping'
const MAX_AGE_MS = 8 * 3600 * 1000 // 8 hours

function startBell(ctx: AudioContext): () => void {
  let active = true

  function ring() {
    if (!active) return

    const o1 = ctx.createOscillator(); const g1 = ctx.createGain()
    o1.connect(g1); g1.connect(ctx.destination)
    o1.type = 'sine'; o1.frequency.value = 880
    g1.gain.setValueAtTime(0.45, ctx.currentTime)
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.4)
    o1.start(ctx.currentTime); o1.stop(ctx.currentTime + 1.4)

    const o2 = ctx.createOscillator(); const g2 = ctx.createGain()
    o2.connect(g2); g2.connect(ctx.destination)
    o2.type = 'sine'; o2.frequency.value = 1320
    g2.gain.setValueAtTime(0.25, ctx.currentTime)
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9)
    o2.start(ctx.currentTime); o2.stop(ctx.currentTime + 0.9)

    const o3 = ctx.createOscillator(); const g3 = ctx.createGain()
    o3.connect(g3); g3.connect(ctx.destination)
    o3.type = 'sine'; o3.frequency.value = 1760
    g3.gain.setValueAtTime(0.12, ctx.currentTime)
    g3.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o3.start(ctx.currentTime); o3.stop(ctx.currentTime + 0.6)

    if (active) setTimeout(ring, 2200)
  }

  ring()
  return () => { active = false }
}

export function PingNotification() {
  const { incomingPing, setIncomingPing } = useSSEStore()
  const t = useT()
  const stopRef = useRef<(() => void) | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)
  const [reply, setReply] = useState('')

  // On mount: restore a pending ping from localStorage if not already set via SSE
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return
    try {
      const parsed = JSON.parse(stored) as PingData & { stored_at?: number }
      if (Date.now() - (parsed.stored_at ?? 0) > MAX_AGE_MS) {
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      const { stored_at, ...ping } = parsed as typeof parsed & { stored_at?: number }
      void stored_at
      setIncomingPing(ping as PingData)
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, []) // mount only — SSE will overwrite if a new ping arrives

  // Start/stop bell sound
  useEffect(() => {
    if (!incomingPing) return
    setReply('')
    const ctx = new AudioContext()
    ctxRef.current = ctx
    ctx.resume().then(() => {
      stopRef.current = startBell(ctx)
    }).catch(() => {
      stopRef.current = startBell(ctx)
    })
    return () => {
      stopRef.current?.(); stopRef.current = null
      ctxRef.current?.close(); ctxRef.current = null
    }
  }, [incomingPing?.check_id])

  const titleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const notifRef = useRef<Notification | null>(null)

  // Tab title blink + browser notification
  useEffect(() => {
    if (!incomingPing) return

    const originalTitle = document.title

    // Blink tab title
    let blink = false
    titleIntervalRef.current = setInterval(() => {
      document.title = blink ? originalTitle : `🔔 درخواست حضور — ${incomingPing.from_name}`
      blink = !blink
    }, 900)

    // Browser notification
    function showNotif() {
      const body = incomingPing!.message || `از ${incomingPing!.from_name}`
      const n = new Notification('remo — درخواست حضور', { body, icon: '/favicon.ico', requireInteraction: true })
      notifRef.current = n
      n.onclick = () => { window.focus(); n.close() }
    }

    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        showNotif()
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then(p => { if (p === 'granted') showNotif() })
      }
    }

    return () => {
      if (titleIntervalRef.current) clearInterval(titleIntervalRef.current)
      document.title = originalTitle
      notifRef.current?.close()
    }
  }, [incomingPing?.check_id])

  const handleConfirm = useCallback(async () => {
    if (!incomingPing) return
    stopRef.current?.(); stopRef.current = null
    ctxRef.current?.close(); ctxRef.current = null
    if (titleIntervalRef.current) clearInterval(titleIntervalRef.current)
    document.title = 'remo'
    notifRef.current?.close()
    localStorage.removeItem(STORAGE_KEY)
    try {
      await statusService.respondPing(incomingPing.check_id, incomingPing.from_user_id, reply.trim())
    } catch { /* silent */ }
    setIncomingPing(null)
  }, [incomingPing, reply, setIncomingPing])

  if (!incomingPing) return null

  return (
    // No onClick on backdrop — modal cannot be dismissed without confirming
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" dir="rtl">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-7 max-w-xs w-full mx-4 border border-gray-200 dark:border-slate-600 text-center">

        <div className="mb-4">
          <span
            className="text-6xl select-none"
            style={{ display: 'inline-block', animation: 'bellRing 0.45s ease-in-out infinite alternate' }}
          >🔔</span>
        </div>
        <style>{`@keyframes bellRing { from { transform: rotate(-18deg); } to { transform: rotate(18deg); } }`}</style>

        <h2 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-1">{t('ping_incoming')}</h2>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">{incomingPing.from_name}</p>

        {incomingPing.message && (
          <div className="bg-gray-50 dark:bg-slate-700 rounded-xl px-4 py-3 mb-4 text-right">
            <p className="text-sm text-gray-800 dark:text-slate-100 leading-relaxed">{incomingPing.message}</p>
          </div>
        )}

        <textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          placeholder={t('ping_message_placeholder')}
          rows={2}
          className="w-full text-sm border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2 bg-gray-50 dark:bg-slate-700 text-gray-800 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-700 mb-4 text-right"
        />

        <button
          onClick={handleConfirm}
          className="w-full py-3 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl font-bold text-sm transition-all"
        >
          ✓ {t('ping_confirm')}
        </button>
      </div>
    </div>
  )
}
