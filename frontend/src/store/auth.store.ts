import { create } from 'zustand'
import type { Me } from '@/types'

interface AuthState {
  user: Me | null
  token: string | null
  setAuth: (user: Me, token: string) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => {
    localStorage.setItem('access_token', token)
    set({ user, token })
  },
  clearAuth: () => {
    localStorage.removeItem('access_token')
    set({ user: null, token: null })
  },
}))
