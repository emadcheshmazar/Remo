import { create } from 'zustand'
import type { PingData, PingResultData } from '@/types'

interface StatusEntry { status: string; updated_at: string }

interface SSEStore {
  statusMap: Record<string, StatusEntry>
  connected: boolean
  incomingPing: PingData | null
  pingResult: PingResultData | null
  setConnected: (v: boolean) => void
  applySnapshot: (statuses: Array<{ user_id: string; status: string; updated_at: string }>) => void
  updateStatus: (user_id: string, status: string, updated_at: string) => void
  setIncomingPing: (ping: PingData | null) => void
  setPingResult: (result: PingResultData | null) => void
}

export const useSSEStore = create<SSEStore>((set) => ({
  statusMap: {},
  connected: false,
  incomingPing: null,
  pingResult: null,
  setConnected: (connected) => set({ connected }),
  applySnapshot: (statuses) => {
    const map: Record<string, StatusEntry> = {}
    for (const s of statuses) map[s.user_id] = { status: s.status, updated_at: s.updated_at }
    set({ statusMap: map })
  },
  updateStatus: (user_id, status, updated_at) =>
    set((state) => ({ statusMap: { ...state.statusMap, [user_id]: { status, updated_at } } })),
  setIncomingPing: (ping) => set({ incomingPing: ping }),
  setPingResult: (result) => set({ pingResult: result }),
}))
