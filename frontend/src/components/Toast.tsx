'use client'

import { useToastStore } from '@/store/toast.store'

const VARIANT_CLS: Record<string, string> = {
  error: 'bg-red-600 dark:bg-red-700',
  success: 'bg-green-600 dark:bg-green-700',
  info: 'bg-gray-800 dark:bg-slate-700',
}

export function Toast() {
  const { toasts, dismiss } = useToastStore()

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 inset-x-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className={`pointer-events-auto max-w-md w-full sm:w-auto flex items-start gap-3 text-white text-sm rounded-lg shadow-lg px-4 py-3 ${VARIANT_CLS[toast.variant]}`}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 text-white/80 hover:text-white leading-none"
            aria-label="dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
