import { create } from 'zustand'
import type { Me } from '@/types'

interface AuthState {
  user: Me | null
  token: string | null
  hydrated: boolean
  setAuth: (user: Me, token: string) => void
  clearAuth: () => void
  setHydrated: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  hydrated: false,
  setAuth: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, token, hydrated: true })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, token: null, hydrated: true })
  },
  setHydrated: () => set({ hydrated: true }),
}))
