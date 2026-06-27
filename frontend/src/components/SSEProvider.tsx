'use client'

import { useEffect } from 'react'
import { useSSEStore } from '@/store/sse.store'

interface Props { userId: string }

export function SSEProvider({ userId }: Props) {
  const { setConnected, applySnapshot, updateStatus, setIncomingPing, setPingResult } = useSSEStore()

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) return

    const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
    const url = `${base}/api/v1/status/stream?token=${encodeURIComponent(token)}`
    let es: EventSource
    let retryTimeout: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource(url)

      es.onopen = () => setConnected(true)

      es.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'snapshot') {
          applySnapshot(data.statuses)
        } else if (data.type === 'update') {
          updateStatus(data.user_id, data.status, data.updated_at)
        } else if (data.type === 'ping_check' && data.target_user_id === userId) {
          const ping = { check_id: data.check_id, target_user_id: data.target_user_id, from_user_id: data.from_user_id, from_name: data.from_name, message: data.message ?? '' }
          localStorage.setItem('remo_pending_ping', JSON.stringify({ ...ping, stored_at: Date.now() }))
          setIncomingPing(ping)
        } else if (data.type === 'ping_response' && data.from_user_id === userId) {
          setPingResult(data)
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        retryTimeout = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimeout)
      es?.close()
      setConnected(false)
    }
  }, [userId])

  return null
}
