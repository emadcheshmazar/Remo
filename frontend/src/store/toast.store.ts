import { create } from 'zustand'

export type ToastVariant = 'error' | 'success' | 'info'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastState {
  toasts: ToastItem[]
  push: (message: string, variant?: ToastVariant) => void
  dismiss: (id: number) => void
}

let nextId = 1
const AUTO_DISMISS_MS = 6000

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'error') => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, AUTO_DISMISS_MS)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
