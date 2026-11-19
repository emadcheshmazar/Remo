import type { JiraSyncStatus, TaskPriority, TaskStatus } from '@/types'
import type { TKey } from '@/utils/translations'
import { formatJalali, isoToJalali } from '@/utils/jalali'

export const PRIORITIES: TaskPriority[] = ['highest', 'high', 'medium', 'low', 'lowest']
export const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled']

export const PRIORITY_KEY: Record<TaskPriority, TKey> = {
  highest: 'priority_highest',
  high: 'priority_high',
  medium: 'priority_medium',
  low: 'priority_low',
  lowest: 'priority_lowest',
}

export const STATUS_KEY: Record<string, TKey> = {
  todo: 'status_todo',
  in_progress: 'status_in_progress',
  done: 'status_done',
  cancelled: 'status_cancelled',
}

export const SYNC_KEY: Record<JiraSyncStatus, TKey> = {
  synced: 'sync_synced',
  pending: 'sync_pending',
  error: 'sync_error',
  not_configured: 'sync_not_configured',
  unmapped: 'sync_unmapped',
}

export const PRIORITY_CLASS: Record<TaskPriority, string> = {
  highest: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  lowest: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
}

export const STATUS_CLASS: Record<string, string> = {
  todo: 'bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-200',
  in_progress: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  cancelled: 'bg-ink-100 text-ink-400 line-through dark:bg-ink-900 dark:text-ink-500',
}

export const SYNC_CLASS: Record<JiraSyncStatus, string> = {
  synced: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  error: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  not_configured: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
  unmapped: 'bg-sky-100 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300',
}

export function formatEstimate(minutes: number | null): string {
  if (minutes == null) return '—'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours && mins) return `${hours}h ${mins}m`
  if (hours) return `${hours}h`
  return `${mins}m`
}

export function formatDue(iso: string | null): string {
  if (!iso) return '—'
  const [jy, jm, jd] = isoToJalali(iso.slice(0, 10))
  return formatJalali(jy, jm, jd)
}

export function statusText(status: string, t: (key: TKey) => string): string {
  const key = STATUS_KEY[status]
  return key ? t(key) : status
}

export function statusClass(status: string): string {
  return STATUS_CLASS[status] || STATUS_CLASS.in_progress
}

export const LABEL_COLORS = ['#0f766e', '#0284c7', '#d97706', '#e11d48', '#475569', '#059669']
